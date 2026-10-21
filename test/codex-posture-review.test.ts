import assert from "node:assert/strict";
import test from "node:test";
import { inspectCodexPosture } from "../src/codex-posture.ts";
import { reviewCodexPosture } from "../src/codex-posture-review.ts";

const make = (sandbox: string, approval = "on-request", network = false) =>
  inspectCodexPosture(
    `sandbox_mode = "${sandbox}"\napproval_policy = "${approval}"\n[sandbox_workspace_write]\nnetwork_access = ${network}`,
  );
test("static posture review: sandbox widening and narrowing are conditional config directions", () => {
  assert.equal(reviewCodexPosture(make("read-only"), make("danger-full-access")).direction,
    "broader-configured-sandbox");
  assert.equal(reviewCodexPosture(make("danger-full-access"), make("read-only")).direction,
    "narrower-configured-sandbox");
  assert.equal(reviewCodexPosture(make("read-only"), make("read-only")).direction,
    "unchanged");
});
test("static posture review: prompt policy and network changes are distinct", () => {
  assert.equal(reviewCodexPosture(make("workspace-write", "on-request"), make("workspace-write", "never")).direction,
    "fewer-approval-prompts");
  assert.equal(reviewCodexPosture(make("workspace-write", "never"), make("workspace-write", "on-request")).direction,
    "more-approval-prompts");
  assert.equal(reviewCodexPosture(make("workspace-write", "on-request", false), make("workspace-write", "on-request", true)).direction,
    "broader-configured-sandbox");
  assert.equal(reviewCodexPosture(make("workspace-write", "on-request", true), make("workspace-write", "on-request", false)).direction,
    "narrower-configured-sandbox");
});
test("static posture review: changes in multiple dimensions are not forced into one risk direction", () => {
  const result = reviewCodexPosture(make("read-only", "on-request"), make("workspace-write", "never"));
  assert.equal(result.direction, "unknown");
  assert.deepEqual(result.unresolved, ["Workspace network setting changed outside a stable workspace-write mode"]);
});
test("static posture review: missing premises and supported unsupported config remain unknown", () => {
  const known = make("workspace-write");
  for (const unknown of [
    inspectCodexPosture('sandbox_mode = "workspace-write"'),
    inspectCodexPosture('approval_policy = "on-request"'),
    inspectCodexPosture('sandbox_mode = "workspace-write"\napproval_policy = "never"\n[profiles.default]\nsandbox_mode = "read-only"'),
  ]) {
    const result = reviewCodexPosture(known, unknown);
    assert.equal(result.direction, "unknown");
    assert.ok(result.unresolved.length);
    assert.equal(result.runtimeVerified, false);
    assert.equal(result.runtimePermissionDiff, false);
  }
});
test("static posture review: unmodeled exclusions never silently become certain", () => {
  const before = inspectCodexPosture('sandbox_mode="workspace-write"\napproval_policy="on-request"\n[sandbox_workspace_write]\nnetwork_access=false\nexclude_slash_tmp=false');
  const after = inspectCodexPosture('sandbox_mode="workspace-write"\napproval_policy="on-request"\n[sandbox_workspace_write]\nnetwork_access=false\nexclude_slash_tmp=true');
  assert.equal(reviewCodexPosture(before, after).direction, "unknown");
});
