import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { devNull } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { readPolicy } from "../src/index.ts";

const cli = resolve("src/cli.ts");
const cleanEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)),
  );
function fixture() {
  const directory = mkdtempSync(resolve(".apd-test-audit-"));
  const env = {
    ...cleanEnv(),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: devNull,
  };
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
      env,
    }).trim();
  git("init", "--quiet");
  mkdirSync(join(directory, ".claude"));
  const file = join(directory, ".claude/settings.json");
  const commit = (content: string | Buffer) => {
    writeFileSync(file, content);
    git("add", ".claude/settings.json");
    git(
      "-c",
      "user.name=Audit",
      "-c",
      "user.email=audit@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${devNull}`,
      "commit",
      "-q",
      "-m",
      "fixture",
    );
    return git("rev-parse", "HEAD");
  };
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--experimental-strip-types", cli, ...args], {
      cwd: directory,
      encoding: "utf8",
      env,
    });
  const dispose = () => rmSync(directory, { recursive: true, force: true });
  return { directory, file, git, commit, run, dispose };
}

test("audit Git: malicious revisions fail without shell execution or JSON success output", () => {
  const f = fixture();
  try {
    const revision = f.commit('{"permissions":{"deny":["Bash"]}}');
    const index = readFileSync(join(f.directory, ".git/index"));
    for (const ref of [
      "--help",
      "-C",
      "",
      "HEAD;touch OWNED",
      "$(touch OWNED)",
      "HEAD\n",
      "HEAD^{tree}",
      "HEAD:.claude/settings.json",
      "a".repeat(1025),
    ]) {
      assert.throws(() => readPolicy(f.directory, ref), { name: "Error" }, ref);
      const result = f.run("scan", ref, "--json");
      assert.equal(result.status, 2, ref);
      assert.equal(result.stdout, "", ref);
    }
    assert.throws(() => readPolicy(f.directory, "HEAD\0"), /Invalid/);
    f.git("tag", "audit-tag", revision);
    assert.equal(readPolicy(f.directory, "audit-tag").revision, revision);
    assert.equal(readPolicy(f.directory, `${revision}~0`).revision, revision);
    assert.equal(existsSync(join(f.directory, "OWNED")), false);
    assert.deepEqual(readFileSync(join(f.directory, ".git/index")), index);
    for (const args of [
      ["compare", "HEAD"],
      ["scan", "HEAD", "--json", "--json"],
      ["scan", "HEAD", "extra"],
      ["--json"],
    ]) {
      const result = f.run(...args);
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
    }
    assert.equal(f.run("scan", "HEAD", "--json").status, 0); // Report creation, not a security pass.
    mkdirSync(join(f.directory, " \n "));
    assert.throws(
      () => readPolicy(join(f.directory, " \n "), "HEAD"),
      /repository root/,
    );
  } finally {
    f.dispose();
  }
});

test("audit Git: inherited Git configuration, trace paths and repository overrides are scrubbed", () => {
  const f = fixture();
  const poison = {
    GIT_DIR: join(f.directory, "nonexistent"),
    GIT_WORK_TREE: join(f.directory, "nonexistent"),
    GIT_INDEX_FILE: join(f.directory, "unexpected-index"),
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.repositoryformatversion",
    GIT_CONFIG_VALUE_0: "999",
    GIT_TRACE: join(f.directory, "unexpected-trace"),
    GIT_NO_LAZY_FETCH: "0",
    GIT_ICASE_PATHSPECS: "1",
  };
  const previous = Object.fromEntries(
    Object.keys(poison).map((key) => [key, process.env[key]]),
  );
  try {
    const revision = f.commit('{"permissions":{"deny":["Bash"]}}');
    Object.assign(process.env, poison);
    assert.equal(readPolicy(f.directory, "HEAD").revision, revision);
    assert.equal(existsSync(poison.GIT_INDEX_FILE), false);
    assert.equal(existsSync(poison.GIT_TRACE), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    f.dispose();
  }
});

test("audit Git: malformed UTF-8 is an error, not lossy replacement and an unchanged policy", () => {
  const f = fixture();
  try {
    const make = (byte: number) =>
      Buffer.concat([
        Buffer.from('{"hooks":"'),
        Buffer.from([byte]),
        Buffer.from('"}'),
      ]);
    const before = f.commit(make(0xff)),
      after = f.commit(make(0xfe));
    for (const ref of [before, after]) {
      assert.throws(() => readPolicy(f.directory, ref), /UTF-8/);
      const result = f.run("scan", ref, "--json");
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
    }
    const withBOM = f.commit(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('{"permissions":{"allow":["Bash"]}}'),
      ]),
    );
    assert.ok(
      readPolicy(f.directory, withBOM).issues.some((issue) =>
        issue.message.includes("Invalid JSON"),
      ),
    );
  } finally {
    f.dispose();
  }
});

test(
  "audit Git: old Git fails closed when it cannot honor --no-lazy-fetch",
  { skip: process.platform === "win32" },
  () => {
    const directory = mkdtempSync(resolve(".apd-test-oldgit-"));
    const originalPath = process.env.PATH;
    try {
      const stub = join(directory, "git");
      writeFileSync(
        stub,
        `#!/usr/bin/env node\nconst a=process.argv.slice(2); if(a.includes("--no-lazy-fetch"))process.exit(129); if(a.includes("--show-prefix"))process.stdout.write("\\n"); else if(a.includes("--verify"))process.stdout.write("${"a".repeat(40)}\\n");\n`,
      );
      chmodSync(stub, 0o755);
      process.env.PATH = directory + ":" + originalPath;
      assert.throws(() => readPolicy(directory, "HEAD"), /no-lazy-fetch/);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test("audit CLI: resource limits emit exit 2 with no partial report", () => {
  const f = fixture();
  try {
    const permissions = {
      allow: Array.from({ length: 129 }, (_, i) => `Bash(command${i})`),
    };
    const revision = f.commit(JSON.stringify({ permissions }));
    const result = f.run("scan", revision, "--json");
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /limit/);
  } finally {
    f.dispose();
  }
});
