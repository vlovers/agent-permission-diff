import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectCodexPosture,
  compareCodexPosture,
} from "../src/codex-posture.ts";

test("Codex workspace network: official table boolean is recognized", () => {
  const p = inspectCodexPosture(
    'approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n[sandbox_workspace_write]\nnetwork_access = true # explicit\n',
  );
  assert.deepEqual(p.issues, []);
  assert.deepEqual(p.values, {
    approval_policy: "on-request",
    sandbox_mode: "workspace-write",
    "sandbox_workspace_write.network_access": true,
  });
  assert.equal(p.complete, false);
});

test("Codex workspace network: config posture change is not runtime authorization", () => {
  const left = inspectCodexPosture(
    'sandbox_mode="workspace-write"\n[sandbox_workspace_write]\nnetwork_access=false',
  );
  const right = inspectCodexPosture(
    'sandbox_mode="workspace-write"\n[sandbox_workspace_write]\nnetwork_access=true',
  );
  const diff = compareCodexPosture(left, right);
  assert.deepEqual(diff.changes, [
    {
      key: "sandbox_workspace_write.network_access",
      before: false,
      after: true,
    },
  ]);
  assert.equal(diff.uncertain, false);
  assert.equal(diff.runtimePermissionDiff, false);
});

test("Codex workspace network: unsupported nested and duplicate keys invalidate entire posture", () => {
  const unknown = [
    '[sandbox_workspace_write]\nnetwork_access="true"',
    "[sandbox_workspace_write]\nnetwork_access=1",
    "[sandbox_workspace_write]\nnetwork_access=true\nnetwork_access=false",
    '[sandbox_workspace_write]\nnetwork_access=true\nwritable_roots=["/tmp"]',
    '[sandbox_workspace_write]\nnetwork_access=true\n[profiles.local]\nsandbox_mode="read-only"',
    "[sandbox_workspace_write]\nnetwork_access=true\n[sandbox_workspace_write]\nnetwork_access=false",
  ];
  for (const config of unknown) {
    const parsed = inspectCodexPosture(config);
    assert.ok(parsed.issues.length > 0);
    assert.deepEqual(parsed.values, {});
    assert.equal(compareCodexPosture(parsed, parsed).uncertain, true);
    assert.deepEqual(compareCodexPosture(parsed, parsed).changes, []);
  }
});

test("Codex workspace network: known false and absent are distinct posture states", () => {
  const before = inspectCodexPosture('sandbox_mode="workspace-write"');
  const after = inspectCodexPosture(
    'sandbox_mode="workspace-write"\n[sandbox_workspace_write]\nnetwork_access=false',
  );
  const diff = compareCodexPosture(before, after);
  assert.deepEqual(diff.changes, [
    {
      key: "sandbox_workspace_write.network_access",
      before: null,
      after: false,
    },
  ]);
});

test("Codex workspace exclusions: both documented flags are compared without runtime claims", () => {
  const before = inspectCodexPosture(
    'sandbox_mode="workspace-write"\n[sandbox_workspace_write]\nexclude_slash_tmp=false\nexclude_tmpdir_env_var=true',
  );
  const after = inspectCodexPosture(
    'sandbox_mode="workspace-write"\n[sandbox_workspace_write]\nexclude_slash_tmp=true\nexclude_tmpdir_env_var=false',
  );
  assert.deepEqual(before.issues, []);
  assert.deepEqual(after.issues, []);
  assert.deepEqual(compareCodexPosture(before, after).changes, [
    {
      key: "sandbox_workspace_write.exclude_slash_tmp",
      before: false,
      after: true,
    },
    {
      key: "sandbox_workspace_write.exclude_tmpdir_env_var",
      before: true,
      after: false,
    },
  ]);
  assert.equal(compareCodexPosture(before, after).runtimePermissionDiff, false);
});
