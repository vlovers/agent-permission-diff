import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePolicies,
  evaluateWithSources,
  parsePolicy,
} from "../src/index.ts";
import type { SessionContext, PermissionSource } from "../src/index.ts";

const settings = ".claude/settings.json";
const policy = parsePolicy("commit", {
  [settings]: JSON.stringify({
    permissions: {
      allow: ["Bash(npm test)", "WebSearch"],
      ask: ["Bash(npm run build)"],
      deny: ["Bash(git push *)"],
    },
  }),
});
const trusted: SessionContext = {
  projectTrust: "trusted",
  permissionMode: "default",
  externalInfluences: "none",
};
const knownAbsent: PermissionSource[] = [
  { kind: "managed", availability: "absent-asserted" },
  { kind: "user", availability: "absent-asserted" },
  { kind: "session", availability: "absent-asserted" },
  { kind: "hooks", availability: "absent-asserted" },
];

test("sources integration: Git policy never proves external configuration absent", () => {
  for (const input of ["npm test", "npm run build", "git push origin main"]) {
    const result = evaluateWithSources(policy, "Bash", input, trusted);
    assert.equal(result.contextual.decision, "UNKNOWN");
    assert.notEqual(result.modeled.decision, "UNKNOWN");
    assert.equal(result.runtimeVerified, false);
    assert.deepEqual(result.unresolved, []);
    assert.deepEqual(result.unresolvedSources, [
      "managed",
      "user",
      "project-local",
      "session",
      "hooks",
    ]);
    assert.match(result.contextual.reason, /Uninspected permission sources/);
  }
});

test("sources integration: even asserted external absence cannot prove absent untracked local file", () => {
  const result = evaluateWithSources(
    policy,
    "Bash",
    "npm test",
    trusted,
    knownAbsent,
  );
  assert.equal(result.contextual.decision, "UNKNOWN");
  assert.deepEqual(result.unresolvedSources, ["project-local"]);
  assert.equal(result.inventory.runtimeVerified, false);
});

test("sources integration: explicitly inspected tracked local file removes only its own uncertainty", () => {
  const both = parsePolicy("commit", {
    [settings]: JSON.stringify({ permissions: { allow: ["Bash(npm test)"] } }),
    ".claude/settings.local.json": JSON.stringify({ permissions: {} }),
  });
  const result = evaluateWithSources(
    both,
    "Bash",
    "npm test",
    trusted,
    knownAbsent,
  );
  assert.equal(result.modeled.decision, "ALLOW");
  assert.equal(result.contextual.decision, "ALLOW");
  assert.deepEqual(result.unresolvedSources, []);
  assert.equal(result.runtimeVerified, false);
});

test("sources integration: unknown session assumptions remain UNKNOWN with complete source assertions", () => {
  const both = parsePolicy("commit", {
    [settings]: JSON.stringify({ permissions: { deny: ["Bash"] } }),
    ".claude/settings.local.json": JSON.stringify({ permissions: {} }),
  });
  for (const field of [
    "projectTrust",
    "permissionMode",
    "externalInfluences",
  ] as const) {
    const context: SessionContext = {
      ...trusted,
      [field]:
        field === "projectTrust"
          ? "unknown"
          : field === "permissionMode"
            ? "other"
            : "present",
    };
    const result = evaluateWithSources(
      both,
      "Bash",
      "npm test",
      context,
      knownAbsent,
    );
    assert.equal(result.contextual.decision, "UNKNOWN");
    assert.deepEqual(result.unresolved, [field]);
    assert.deepEqual(result.unresolvedSources, []);
    assert.equal(result.modeled.decision, "DENY");
  }
});

test("sources integration: externally present uninspected source remains unresolved", () => {
  const both = parsePolicy("commit", {
    [settings]: JSON.stringify({ permissions: { allow: ["WebSearch"] } }),
    ".claude/settings.local.json": JSON.stringify({ permissions: {} }),
  });
  const facts = knownAbsent.map((source) =>
    source.kind === "managed"
      ? { ...source, availability: "present-uninspected" as const }
      : source,
  );
  const result = evaluateWithSources(both, "WebSearch", "*", trusted, facts);
  assert.equal(result.contextual.decision, "UNKNOWN");
  assert.deepEqual(result.unresolvedSources, ["managed"]);
  assert.equal(result.runtimeVerified, false);
});

test("sources integration: malformed context and facts fail closed", () => {
  assert.throws(
    () => evaluateWithSources(policy, "Bash", "npm test", null as never),
    /Invalid explicit session context/,
  );
  assert.throws(
    () =>
      evaluateWithSources(policy, "Bash", "npm test", trusted, [
        { kind: "managed", availability: "inspected" },
      ]),
    /External source cannot claim to have been inspected/,
  );
});

test("sources integration: source review neither mutates policy nor changes legacy report", () => {
  const before = JSON.stringify(policy);
  const comparison = comparePolicies(policy, policy);
  evaluateWithSources(policy, "Bash", "npm test", trusted, knownAbsent);
  assert.equal(JSON.stringify(policy), before);
  assert.deepEqual(comparePolicies(policy, policy), comparison);
  assert.equal(comparison.schemaVersion, 1);
});
