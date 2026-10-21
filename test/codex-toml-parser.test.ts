import assert from "node:assert/strict";
import test from "node:test";
import { inspectCodexPosture, compareCodexPosture } from "../src/codex-posture.ts";

test("standards TOML: quotes, dotted keys, comments and reordered tables are semantically equivalent", () => {
  const first = inspectCodexPosture(
    "# project config\napproval_policy = 'on-request'\nsandbox_mode = \"workspace-write\"\n[sandbox_workspace_write]\nnetwork_access = true\nexclude_slash_tmp = false",
  );
  const second = inspectCodexPosture(
    'sandbox_mode = """workspace-write"""\napproval_policy = "on-request"\nsandbox_workspace_write.network_access = true\nsandbox_workspace_write.exclude_slash_tmp = false',
  );
  assert.deepEqual(first.issues, []);
  assert.deepEqual(second.issues, []);
  assert.deepEqual(compareCodexPosture(first, second).changes, []);
  assert.equal(first.values["sandbox_workspace_write.network_access"], true);
  assert.equal(first.complete, false);
});

test("standards TOML: unsupported profile and security-relevant fields block conclusions", () => {
  for (const raw of [
    '[profiles.production]\napproval_policy = "never"',
    '[sandbox_workspace_write]\nwritable_roots = ["/home"]',
    'approval_policy = { granular = { rules = true } }',
    'model = "secret-should-never-echo"\napproval_policy = "never"',
  ]) {
    const snapshot = inspectCodexPosture(raw);
    assert.ok(snapshot.issues.length);
    assert.deepEqual(snapshot.values, {});
    assert.equal(compareCodexPosture(snapshot, snapshot).uncertain, true);
    assert.ok(!JSON.stringify(snapshot).includes("secret-should-never-echo"));
  }
});

test("standards TOML: duplicate tables and duplicate assignments fail closed", () => {
  for (const raw of [
    'sandbox_mode="read-only"\nsandbox_mode="workspace-write"',
    '[sandbox_workspace_write]\nnetwork_access=true\n[sandbox_workspace_write]\nnetwork_access=false',
  ]) {
    const snapshot = inspectCodexPosture(raw);
    assert.ok(snapshot.issues.length);
    assert.deepEqual(snapshot.values, {});
  }
});
