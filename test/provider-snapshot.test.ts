import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { readTrackedProviderSnapshot } from "../src/provider-snapshot.ts";
import { readPolicy } from "../src/index.ts";

function repository() {
  const directory = mkdtempSync(join(tmpdir(), "rulewitness-provider-snapshot-"));
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
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  const write = (path: string, content: string) => {
    const full = join(directory, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  const commit = () => {
    git("add", "--all");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${devNull}`,
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "snapshot",
    );
    return git("rev-parse", "HEAD");
  };
  return {
    directory,
    git,
    write,
    commit,
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("snapshot: exact Git commits distinguish Claude, Codex, mixed and absent", () => {
  const f = repository();
  try {
    const empty = f.commit();
    f.write(".claude/settings.json", JSON.stringify({
      permissions: { allow: ["WebSearch"] },
    }));
    const claude = f.commit();
    f.write(".codex/config.toml", 'sandbox_mode = "workspace-write"\n');
    const mixed = f.commit();
    f.git("rm", "--quiet", ".claude/settings.json");
    const codex = f.commit();
    const absent = readTrackedProviderSnapshot(f.directory, empty);
    const onlyClaude = readTrackedProviderSnapshot(f.directory, claude);
    const both = readTrackedProviderSnapshot(f.directory, mixed);
    const onlyCodex = readTrackedProviderSnapshot(f.directory, codex);
    assert.equal(absent.selection.kind, "absent");
    assert.equal(absent.claudePolicy, null);
    assert.equal(onlyClaude.selection.kind, "claude-code");
    assert.deepEqual(onlyClaude.claudePolicy, readPolicy(f.directory, claude));
    assert.equal(both.selection.kind, "ambiguous");
    assert.equal(both.claudePolicy, null);
    assert.equal(onlyCodex.selection.kind, "unsupported");
    assert.equal(onlyCodex.claudePolicy, null);
    assert.equal(both.revision, mixed);
    assert.equal(onlyCodex.revision, codex);
    // The checked-out HEAD remains irrelevant for earlier revision snapshots.
    assert.equal(f.git("rev-parse", "HEAD"), codex);
  } finally {
    f.close();
  }
});

test("snapshot: dirty checkout is ignored; neither worktree nor index changes", () => {
  const f = repository();
  try {
    f.write(".claude/settings.json", JSON.stringify({
      permissions: { ask: ["WebSearch"] },
    }));
    const head = f.commit();
    const index = readFileSync(join(f.directory, ".git/index"));
    f.write(".claude/settings.json", "broken uncommitted JSON");
    f.write(".codex/config.toml", "untracked and not part of Git revision");
    const result = readTrackedProviderSnapshot(f.directory, head);
    assert.equal(result.selection.kind, "claude-code");
    assert.equal(result.claudePolicy?.issues.length, 0);
    assert.deepEqual(readFileSync(join(f.directory, ".git/index")), index);
    assert.equal(
      readFileSync(join(f.directory, ".claude/settings.json"), "utf8"),
      "broken uncommitted JSON",
    );
  } finally {
    f.close();
  }
});

test("snapshot: symlinked Codex file and directory are rejected", () => {
  const f = repository();
  try {
    f.write("placeholder", "ordinary");
    f.write(".codex/config.toml", "sandbox_mode = \"read-only\"");
    const base = f.commit();
    assert.equal(
      readTrackedProviderSnapshot(f.directory, base).selection.kind,
      "unsupported",
    );
    rmSync(join(f.directory, ".codex/config.toml"));
    symlinkSync("../placeholder", join(f.directory, ".codex/config.toml"));
    const linkedFile = f.commit();
    assert.throws(
      () => readTrackedProviderSnapshot(f.directory, linkedFile),
      /Unsafe Codex config path/,
    );
    rmSync(join(f.directory, ".codex"), { recursive: true });
    symlinkSync("placeholder", join(f.directory, ".codex"));
    const linkedDirectory = f.commit();
    assert.throws(
      () => readTrackedProviderSnapshot(f.directory, linkedDirectory),
      /Unsafe \.codex path/,
    );
  } finally {
    f.close();
  }
});

test("snapshot: missing and hostile refs never become empty success", () => {
  const f = repository();
  try {
    f.commit();
    for (const ref of ["a".repeat(40), "--help", "HEAD;touch OWNED"]) {
      assert.throws(() => readTrackedProviderSnapshot(f.directory, ref));
    }
    assert.equal(f.git("status", "--porcelain"), "");
  } finally {
    f.close();
  }
});
