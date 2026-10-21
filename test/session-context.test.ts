import assert from "node:assert/strict";
import test from "node:test";
import { comparePolicies, evaluateWithContext, parsePolicy } from "../src/index.ts";
import type { SessionContext } from "../src/index.ts";

const p = parsePolicy("HEAD", {
  ".claude/settings.json": JSON.stringify({
    permissions: {
      allow: ["Bash(npm test)", "WebSearch"],
      ask: ["Bash(npm run build)"],
      deny: ["Bash(git push *)"],
    },
  }),
});
const full: SessionContext = {
  projectTrust: "trusted",
  permissionMode: "default",
  externalInfluences: "none",
};

test("context: asserted premises retain conditional configured-rule answers only", () => {
  for (const [input, expected] of [
    ["npm test", "ALLOW"],
    ["npm run build", "ASK"],
    ["git push origin main", "DENY"],
    ["unmatched", "UNKNOWN"],
  ] as const) {
    const result = evaluateWithContext(p, "Bash", input, full);
    assert.equal(result.modeled.decision, expected);
    assert.equal(result.contextual.decision, expected);
    assert.deepEqual(result.unresolved, []);
    assert.equal(result.runtimeVerified, false);
  }
});

test("context: every missing premise degrades all modeled decisions to UNKNOWN", () => {
  for (const field of Object.keys(full) as (keyof SessionContext)[]) {
    for (const value of (
      field === "projectTrust"
        ? ["unknown", "untrusted"]
        : field === "permissionMode"
          ? ["unknown", "other"]
          : ["unknown", "present"]
    )) {
      const context = { ...full, [field]: value } as SessionContext;
      for (const input of ["npm test", "npm run build", "git push origin main"]) {
        const result = evaluateWithContext(p, "Bash", input, context);
        assert.equal(result.contextual.decision, "UNKNOWN");
        assert.deepEqual(result.unresolved, [field]);
        assert.equal(result.runtimeVerified, false);
        assert.ok(result.contextual.reason.length > 10);
        assert.deepEqual(result.contextual.evidence, result.modeled.evidence);
      }
    }
  }
});

test("context: multiple unknown premises report every missing dimension deterministically", () => {
  const context: SessionContext = {
    projectTrust: "unknown",
    permissionMode: "other",
    externalInfluences: "present",
  };
  const result = evaluateWithContext(p, "WebSearch", "*", context);
  assert.deepEqual(result.unresolved, [
    "projectTrust",
    "permissionMode",
    "externalInfluences",
  ]);
  assert.equal(result.modeled.decision, "ALLOW");
  assert.equal(result.contextual.decision, "UNKNOWN");
  assert.equal(result.runtimeVerified, false);
});

test("context: unsupported policy stays UNKNOWN even with asserted full context", () => {
  const malformed = parsePolicy("HEAD", {
    ".claude/settings.json": JSON.stringify({
      permissions: { defaultMode: "plan", allow: ["Bash(npm test)"] },
    }),
  });
  const result = evaluateWithContext(malformed, "Bash", "npm test", full);
  assert.equal(result.modeled.decision, "UNKNOWN");
  assert.equal(result.contextual.decision, "UNKNOWN");
  assert.equal(result.runtimeVerified, false);
});

test("context: malformed JS input fails closed rather than silently assuming full context", () => {
  for (const value of [null, {}, { ...full, projectTrust: "yes" }, {
    ...full, externalInfluences: false,
  }]) {
    assert.throws(
      () => evaluateWithContext(p, "Bash", "npm test", value as SessionContext),
      /Invalid explicit session context/,
    );
  }
});

test("context: opt-in evaluation never mutates policy or changes legacy comparison", () => {
  const original = JSON.stringify(p);
  const before = comparePolicies(p, p);
  evaluateWithContext(p, "Bash", "npm test", {
    projectTrust: "unknown",
    permissionMode: "unknown",
    externalInfluences: "unknown",
  });
  assert.equal(JSON.stringify(p), original);
  assert.deepEqual(comparePolicies(p, p), before);
  assert.equal(before.schemaVersion, 1);
});
