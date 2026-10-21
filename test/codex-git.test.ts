import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  compareTrackedCodexPosture,
  readTrackedCodexPosture,
} from "../src/codex-git.ts";
import { reviewTrackedCodexPosture } from "../src/codex-git.ts";

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
}
function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "rulewitness-codex-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "user.name", "Fixture");
  return root;
}
function commit(root: string, content: string): string {
  mkdirSync(join(root, ".codex"), { recursive: true });
  writeFileSync(join(root, ".codex/config.toml"), content);
  git(root, "add", ".codex/config.toml");
  git(root, "commit", "-qm", "fixture");
  return git(root, "rev-parse", "HEAD");
}

test("Codex Git: compare exact revisions without changing checkout", () => {
  const root = repository();
  try {
    const a = commit(
      root,
      'approval_policy = "on-request"\nsandbox_mode = "read-only"\n',
    );
    const b = commit(
      root,
      'sandbox_mode = "workspace-write"\napproval_policy = "never"\n',
    );
    const result = compareTrackedCodexPosture(root, a, b);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.uncertain, false);
    assert.equal(result.runtimePermissionDiff, false);
    assert.deepEqual(result.posture.changes, [
      { key: "approval_policy", before: "on-request", after: "never" },
      { key: "sandbox_mode", before: "read-only", after: "workspace-write" },
    ]);
    assert.equal(git(root, "rev-parse", "HEAD"), b);
    assert.equal(readTrackedCodexPosture(root, a).revision, a);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex Git: missing project config remains uncertain", () => {
  const root = repository();
  try {
    writeFileSync(join(root, "README.md"), "start");
    git(root, "add", "README.md");
    git(root, "commit", "-qm", "base");
    const a = git(root, "rev-parse", "HEAD");
    const b = commit(root, 'approval_policy="never"');
    const diff = compareTrackedCodexPosture(root, a, b);
    assert.equal(diff.before.present, false);
    assert.equal(diff.uncertain, true);
    assert.deepEqual(diff.posture.changes, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex Git: symlink is rejected, never followed", () => {
  const root = repository();
  try {
    mkdirSync(join(root, ".codex"));
    writeFileSync(join(root, "secret.txt"), 'approval_policy="never"');
    symlinkSync("../secret.txt", join(root, ".codex/config.toml"));
    git(root, "add", ".codex/config.toml");
    git(root, "commit", "-qm", "link");
    assert.throws(
      () => readTrackedCodexPosture(root, "HEAD"),
      /Unsafe Codex configuration/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex Git: oversized blob and invalid refs fail closed", () => {
  const root = repository();
  try {
    commit(root, "x".repeat(65537));
    assert.throws(() => readTrackedCodexPosture(root, "HEAD"), /64 KiB/);
    assert.throws(
      () => readTrackedCodexPosture(root, "--help"),
      /Invalid Git revision/,
    );
    assert.throws(
      () => readTrackedCodexPosture(root, "missing-ref"),
      /Read-only Git operation failed/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex Git: unsupported TOML stays uncertain without leaking raw values", () => {
  const root = repository();
  try {
    const a = commit(root, 'approval_policy="on-request"');
    const b = commit(
      root,
      'model="sensitive-fixture-value"\napproval_policy="never"',
    );
    const diff = compareTrackedCodexPosture(root, a, b);
    assert.equal(diff.uncertain, true);
    assert.deepEqual(diff.posture.changes, []);
    assert.ok(!JSON.stringify(diff).includes("sensitive-fixture-value"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex Git: static review is conditional and does not change checkout", () => {
  const root = repository();
  try {
    const a = commit(root, 'approval_policy="on-request"\nsandbox_mode="read-only"');
    const b = commit(root, 'approval_policy="on-request"\nsandbox_mode="danger-full-access"');
    const result = reviewTrackedCodexPosture(root, a, b);
    assert.equal(result.review.direction, "broader-configured-sandbox");
    assert.equal(result.review.runtimeVerified, false);
    assert.equal(result.review.runtimePermissionDiff, false);
    assert.equal(result.comparison.runtimePermissionDiff, false);
    assert.equal(git(root, "rev-parse", "HEAD"), b);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
