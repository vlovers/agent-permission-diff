import assert from "node:assert/strict";
import test from "node:test";
import {
  assessComparisonGate,
  comparePolicies,
  comparisonOutcome,
  evaluate,
  parsePolicy,
  scanPolicy,
} from "../src/index.ts";

const shared = ".claude/settings.json";
const local = ".claude/settings.local.json";
const create = (permissions: unknown, revision = "rev") =>
  parsePolicy(revision, { [shared]: JSON.stringify({ permissions }) });

test("audit: deny, ask, allow precedence is invariant under list ordering", () => {
  const permutations = [
    { deny: ["Bash(git push *)"], ask: ["Bash(git *)"], allow: ["Bash"] },
    { allow: ["Bash"], ask: ["Bash(git *)"], deny: ["Bash(git push *)"] },
  ];
  for (const permissions of permutations) {
    const policy = create(permissions);
    assert.deepEqual(policy.issues, []);
    assert.equal(evaluate(policy, "Bash", "git push origin main").decision, "DENY");
    assert.equal(evaluate(policy, "Bash", "git status").decision, "ASK");
    assert.equal(evaluate(policy, "Bash", "npm test").decision, "ALLOW");
    assert.equal(scanPolicy(policy).complete, false);
  }
  assert.equal(
    comparisonOutcome(comparePolicies(create(permutations[0]), create(permutations[1]))),
    "modeled-no-op",
  );
});

test("audit: cross-file deny masks project allow, not a runtime trust assertion", () => {
  const before = parsePolicy("before", {
    [shared]: JSON.stringify({ permissions: { allow: ["Bash(git push *)"] } }),
    [local]: JSON.stringify({ permissions: { deny: ["Bash(git push *)"] } }),
  });
  const after = parsePolicy("after", {
    [shared]: JSON.stringify({ permissions: { allow: ["Bash"] } }),
    [local]: JSON.stringify({ permissions: { deny: ["Bash(git push *)"] } }),
  });
  for (const p of [before, after]) {
    assert.equal(evaluate(p, "Bash", "git push origin main").decision, "DENY");
    assert.equal(p.files.length, 2);
  }
  const diff = comparePolicies(before, after);
  assert.equal(diff.complete, false);
  assert.ok(diff.findings.some((f) => f.kind === "permission"));
  assert.ok(
    diff.findings.every(
      (f) => !(f.before.decision === "DENY" && f.after.decision === "ALLOW"),
    ),
  );
});

test("audit: unknown hooks must mask positive grant and retain changed rules as coverage", () => {
  const make = (allow: string[], revision: string) =>
    parsePolicy(revision, {
      [shared]: JSON.stringify({
        hooks: { PreToolUse: [{ matcher: "Bash" }] },
        permissions: { allow },
      }),
    });
  const before = make(["Bash(npm test)"], "before");
  const after = make(["Bash(npm *)"], "after");
  assert.equal(evaluate(after, "Bash", "npm install").decision, "UNKNOWN");
  const report = comparePolicies(before, after);
  assert.equal(comparisonOutcome(report), "uncertain");
  assert.ok(report.findings.some((f) => f.kind === "coverage" && f.tool === "Bash"));
  assert.equal(assessComparisonGate(report, "high").exitCode, 3);
});

test("audit: unsupported runtime mode prevents a confident transition", () => {
  const known = create({ defaultMode: "manual", allow: ["WebSearch"] }, "known");
  const unknown = create(
    { defaultMode: "bypassPermissions", allow: ["WebSearch"] },
    "unknown",
  );
  const report = comparePolicies(known, unknown);
  assert.equal(evaluate(unknown, "WebSearch").decision, "UNKNOWN");
  assert.equal(comparisonOutcome(report), "uncertain");
  assert.equal(assessComparisonGate(report, "info").exitCode, 3);
  assert.ok(report.findings.some((f) => f.after.decision === "UNKNOWN"));
});

test("audit: unsupported external-looking settings do not leak raw values", () => {
  const marker = "sensitive-private-config-token-for-audit";
  const policy = parsePolicy("rev", {
    [shared]: JSON.stringify({
      permissions: {
        allow: ["Bash(npm test)"],
        additionalDirectories: [marker],
      },
      hooks: { PreToolUse: [marker] },
    }),
  });
  assert.ok(policy.issues.length >= 2);
  assert.equal(evaluate(policy, "Bash", "npm test").decision, "UNKNOWN");
  assert.ok(!JSON.stringify(policy).includes(marker));
  assert.equal(scanPolicy(policy).complete, false);
});
