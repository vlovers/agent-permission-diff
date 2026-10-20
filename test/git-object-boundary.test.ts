import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gitEntry, readOnlyGit } from "../src/git-reader.ts";
import { readPolicy } from "../src/git.ts";
import { readTrackedProviderSnapshot } from "../src/provider-snapshot.ts";

function repository() {
  const directory = mkdtempSync(join(tmpdir(), "rulewitness-git-boundary-"));
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)),
    ),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: devNull,
  };
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory, ...args], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  const commit = () => {
    git(
      "-c", "user.name=Fixture",
      "-c", "user.email=fixture@example.invalid",
      "-c", "commit.gpgsign=false",
      "-c", `core.hooksPath=${devNull}`,
      "commit", "-q", "--allow-empty", "-m", "object fixture",
    );
    return git("rev-parse", "HEAD");
  };
  const close = () => rmSync(directory, { recursive: true, force: true });
  return { directory, git, commit, close };
}

test("Git object boundary: gitlink/submodule cannot become Claude or Codex settings", () => {
  for (const path of [".claude", ".codex", ".claude/settings.json", ".codex/config.toml"]) {
    const f = repository();
    try {
      const initial = f.commit();
      f.git("update-index", "--add", "--cacheinfo", `160000,${initial},${path}`);
      const head = f.commit();
      const entry = gitEntry(f.directory, head, path);
      assert.equal(entry?.mode, "160000");
      assert.equal(entry?.type, "commit");
      assert.equal(entry?.oid, initial);
      assert.throws(
        () => readTrackedProviderSnapshot(f.directory, head),
        /Unsafe Claude configuration path|Unsafe \.codex path|Unsafe Codex config path/,
      );
      assert.equal(f.git("rev-parse", "HEAD"), head);
    } finally {
      f.close();
    }
  }
});

test("Git object boundary: metadata stays inert and index is unchanged", () => {
  const f = repository();
  try {
    mkdirSync(join(f.directory, ".claude"));
    writeFileSync(
      join(f.directory, ".claude/settings.json"),
      '{"permissions":{"ask":["WebSearch"]}}',
    );
    f.git("add", ".claude/settings.json");
    const head = f.commit();
    const index = readFileSync(join(f.directory, ".git/index"));
    const entry = gitEntry(f.directory, head, ".claude/settings.json");
    assert.equal(entry?.mode, "100644");
    assert.equal(entry?.type, "blob");
    assert.equal(gitEntry(f.directory, head, ".codex/config.toml"), null);
    assert.equal(readPolicy(f.directory, head).revision, head);
    assert.equal(readTrackedProviderSnapshot(f.directory, head).revision, head);
    assert.deepEqual(readFileSync(join(f.directory, ".git/index")), index);
    assert.equal(f.git("status", "--porcelain"), "");
  } finally {
    f.close();
  }
});

test("Git object boundary: poisoned environment cannot redirect Git reads or write traces", () => {
  const f = repository();
  const poison: Record<string, string> = {
    GIT_DIR: join(f.directory, "nonexistent"),
    GIT_WORK_TREE: join(f.directory, "nonexistent"),
    GIT_INDEX_FILE: join(f.directory, "poison-index"),
    GIT_TRACE: join(f.directory, "poison-trace"),
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.repositoryformatversion",
    GIT_CONFIG_VALUE_0: "999",
    GIT_NO_LAZY_FETCH: "0",
  };
  const previous = Object.fromEntries(
    Object.keys(poison).map((key) => [key, process.env[key]]),
  );
  try {
    const head = f.commit();
    Object.assign(process.env, poison);
    assert.equal(readTrackedProviderSnapshot(f.directory, head).revision, head);
    assert.equal(gitEntry(f.directory, head, ".codex/config.toml"), null);
    assert.equal(existsSync(poison.GIT_INDEX_FILE!), false);
    assert.equal(existsSync(poison.GIT_TRACE!), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    f.close();
  }
});

test("Git object boundary: missing objects, non-commits and invalid tree selectors fail", () => {
  const f = repository();
  try {
    const head = f.commit();
    assert.throws(() => gitEntry(f.directory, "a".repeat(40), ".codex/config.toml"));
    assert.throws(() => gitEntry(f.directory, "HEAD", ".codex/config.toml"), /verified Git commit/);
    assert.throws(() => gitEntry(f.directory, "", ".claude/settings.json"), /verified Git commit/);
    assert.throws(() => readTrackedProviderSnapshot(f.directory, "a".repeat(40)));
    assert.throws(() => readOnlyGit(f.directory, ["show", "a".repeat(40)]));
    assert.equal(readTrackedProviderSnapshot(f.directory, head).selection.kind, "absent");
  } finally {
    f.close();
  }
});
