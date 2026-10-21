import assert from "node:assert/strict";
import test from "node:test";
import {
  compareCodexPosture,
  inspectCodexPosture,
} from "../src/codex-posture.ts";

test("Codex posture: unambiguous root values are inventoried, not authorized", () => {
  const snapshot = inspectCodexPosture(
    'approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n',
  );
  assert.deepEqual(snapshot.values, {
    approval_policy: "on-request",
    sandbox_mode: "workspace-write",
  });
  assert.deepEqual(snapshot.issues, []);
  assert.equal(snapshot.complete, false);
  assert.equal(snapshot.provider, "codex");
});
test("Codex posture: named modes produce posture-only changes", () => {
  const before = inspectCodexPosture(
    'approval_policy = "on-request"\nsandbox_mode = "read-only"',
  );
  const after = inspectCodexPosture(
    'approval_policy = "never"\nsandbox_mode = "danger-full-access"',
  );
  const diff = compareCodexPosture(before, after);
  assert.deepEqual(diff.changes, [
    { key: "approval_policy", before: "on-request", after: "never" },
    { key: "sandbox_mode", before: "read-only", after: "danger-full-access" },
  ]);
  assert.equal(diff.uncertain, false);
  assert.equal(diff.runtimePermissionDiff, false);
});
test("Codex posture: unchanged, reordered and comments make no posture changes", () => {
  const a = inspectCodexPosture(
    'sandbox_mode="read-only"\napproval_policy="never"',
  );
  const b = inspectCodexPosture(
    '# safe\napproval_policy = "never" # note\nsandbox_mode = "read-only"',
  );
  assert.deepEqual(compareCodexPosture(a, b).changes, []);
});
test("Codex posture: unsupported TOML is UNKNOWN and secrets are not echoed", () => {
  for (const raw of [
    "[sandbox_workspace_write]\nnetwork_access=true\nwritable_roots=[]",
    "approval_policy = { granular = { rules = true } }",
    'approval_policy = "maybe"',
    'approval_policy = "never"\napproval_policy = "on-request"',
    'model = "sensitive-token-to-not-print"',
    'include = ["other.toml"]',
    'profile = { name = "prod" }',
  ]) {
    const parsed = inspectCodexPosture(raw);
    assert.ok(parsed.issues.length);
    assert.deepEqual(parsed.values, {});
    assert.ok(!JSON.stringify(parsed).includes("sensitive-token-to-not-print"));
    assert.equal(compareCodexPosture(parsed, parsed).uncertain, true);
    assert.deepEqual(compareCodexPosture(parsed, parsed).changes, []);
  }
});
test("Codex posture: unresolved syntax masks even another supported change", () => {
  const a = inspectCodexPosture('approval_policy="never"');
  const b = inspectCodexPosture(
    'approval_policy="on-request"\n[profile.foo]\nsandbox_mode="read-only"',
  );
  assert.equal(compareCodexPosture(a, b).uncertain, true);
  assert.deepEqual(compareCodexPosture(a, b).changes, []);
});
test("Codex posture: malformed and oversized input fails closed", () => {
  assert.throws(
    () => inspectCodexPosture(null as never),
    /safe limit or is not text/,
  );
  assert.throws(() => inspectCodexPosture("x".repeat(65537)), /safe limit/);
});
