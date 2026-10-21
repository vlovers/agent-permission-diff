import assert from "node:assert/strict";
import test from "node:test";
import {
  assessComparisonGate,
  comparePolicies,
  comparisonOutcome,
  evaluate,
  parsePolicy,
  runPolicyTests,
  scanPolicy,
  validateWitness,
} from "../src/index.ts";

const shared = ".claude/settings.json";
const local = ".claude/settings.local.json";
const pointer = "/permissions/defaultMode";
const unmodeledModes = [
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "future-mode",
] as const;
const policy = (permissions: object, revision = "test") =>
  parsePolicy(revision, {
    [shared]: JSON.stringify({ permissions }),
  });
const rules = {
  deny: ["Bash(git push *)"],
  ask: ["Bash(npm run build)"],
  allow: ["Bash(npm *)", "WebSearch"],
};

test("defaultMode: absent, default and documented manual alias preserve supported decisions", () => {
  const baseline = policy(rules);
  for (const defaultMode of ["default", "manual"]) {
    const explicit = policy({ ...rules, defaultMode });
    assert.deepEqual(explicit.issues, []);
    for (const [tool, input, decision] of [
      ["Bash", "git push origin main", "DENY"],
      ["Bash", "npm run build", "ASK"],
      ["Bash", "npm test", "ALLOW"],
      ["Bash", "unmatched", "UNKNOWN"],
      ["WebSearch", "*", "ALLOW"],
    ] as const) {
      assert.equal(evaluate(explicit, tool, input).decision, decision);
      assert.deepEqual(
        evaluate(explicit, tool, input),
        evaluate(baseline, tool, input),
      );
    }
    assert.equal(
      evaluate(policy({ defaultMode }), "WebSearch").decision,
      "ASK",
    );
    const report = comparePolicies(baseline, explicit);
    assert.deepEqual(report.findings, []);
    assert.equal(comparisonOutcome(report), "modeled-no-op");
  }
});

test("defaultMode: unmodeled and malformed values diagnose all tools without echoing values", () => {
  for (const defaultMode of [
    ...unmodeledModes,
    "",
    "Manual",
    "default ",
    null,
    false,
    1,
    ["default"],
    { mode: "manual" },
  ]) {
    const p = policy({ ...rules, defaultMode });
    assert.equal(p.issues.length, 1);
    assert.match(p.issues[0]!.message, /Unmodeled permissions\.defaultMode/);
    assert.equal(p.issues[0]!.tool, null);
    assert.deepEqual(p.issues[0]!.evidence, {
      revision: "test",
      file: shared,
      pointer,
    });
    for (const [tool, input] of [
      ["Bash", "git push origin main"],
      ["Bash", "npm run build"],
      ["Bash", "npm test"],
      ["Bash", "unmatched"],
      ["WebSearch", "*"],
    ] as const) {
      const result = evaluate(p, tool, input);
      assert.equal(result.decision, "UNKNOWN");
      assert.deepEqual(result.evidence, [p.issues[0]!.evidence]);
    }
    assert.equal(
      evaluate(policy({ defaultMode }), "WebSearch").decision,
      "UNKNOWN",
    );
    const scan = scanPolicy(p);
    assert.equal(scan.complete, false);
    assert.ok(scan.findings.every((f) => f.after.decision === "UNKNOWN"));
    const assertions = runPolicyTests(p, {
      schemaVersion: 1,
      cases: (["ALLOW", "ASK", "DENY", "UNKNOWN"] as const).map((expected) => ({
        name: expected,
        tool: "Bash",
        input: "npm test",
        expected,
      })),
    });
    assert.equal(assertions.passed, false);
    assert.ok(assertions.results.every((r) => r.status === "unknown"));
  }
  assert.ok(
    !JSON.stringify(policy({ defaultMode: "sensitive-value" })).includes(
      "sensitive-value",
    ),
  );
});

test("defaultMode: diagnostics survive shared/local rules and supported mode overrides", () => {
  for (const source of [shared, local]) {
    const other = source === shared ? local : shared;
    const p = parsePolicy("rev", {
      [source]: JSON.stringify({ permissions: { defaultMode: "auto" } }),
      [other]: JSON.stringify({
        permissions: { defaultMode: "default", ...rules },
      }),
    });
    assert.equal(p.issues.length, 1);
    assert.equal(p.issues[0]!.evidence.file, source);
    for (const tool of ["Bash", "WebSearch"])
      assert.equal(evaluate(p, tool, "npm test").decision, "UNKNOWN");
  }
});

test("defaultMode: transitions to and from UNKNOWN replay and never count as proven violations", () => {
  for (const defaultMode of unmodeledModes) {
    for (const decision of ["DENY", "ASK", "ALLOW"] as const) {
      const lists = { [decision.toLowerCase()]: ["Bash", "WebSearch"] };
      const known = policy({ defaultMode: "manual", ...lists }, "known");
      const unknown = policy({ defaultMode, ...lists }, "unknown");
      for (const [before, after] of [
        [known, unknown],
        [unknown, known],
      ] as const) {
        const report = comparePolicies(before, after);
        assert.equal(report.schemaVersion, 1);
        assert.equal(report.complete, false);
        assert.equal(comparisonOutcome(report), "uncertain");
        assert.deepEqual(assessComparisonGate(report, "info"), {
          threshold: "info",
          thresholdExceeded: false,
          uncertain: true,
          violations: [],
          exitCode: 3,
        });
        const transitions = report.findings.filter(
          (f) => f.kind === "permission",
        );
        assert.equal(transitions.length, 2);
        for (const finding of transitions) {
          assert.equal(validateWitness(before, after, finding), true);
          assert.equal(
            finding.before.decision,
            before === unknown ? "UNKNOWN" : decision,
          );
          assert.equal(
            finding.after.decision,
            after === unknown ? "UNKNOWN" : decision,
          );
          assert.equal(finding.explanation!.certainty, "uncertain");
          assert.equal(finding.severity, "MEDIUM");
        }
        assert.ok(
          report.findings.some((f) => f.kind === "coverage" && f.tool === "*"),
        );
      }
    }
  }
});

test("defaultMode: stable unknown modes cannot hide added, removed, moved or widened rules", () => {
  for (const defaultMode of unmodeledModes) {
    for (const [first, second, tool] of [
      [{}, { allow: ["Bash(npm test)"] }, "Bash"],
      [{ deny: ["Bash(npm *)"] }, {}, "Bash"],
      [{ ask: ["Bash(npm test)"] }, { allow: ["Bash(npm test)"] }, "Bash"],
      [{ allow: ["Bash(npm test)"] }, { allow: ["Bash(npm *)"] }, "Bash"],
      [{ ask: ["WebSearch"] }, { allow: ["WebSearch"] }, "WebSearch"],
    ] as const) {
      const before = policy({ defaultMode, ...first }, "before");
      const after = policy({ defaultMode, ...second }, "after");
      const report = comparePolicies(before, after);
      assert.equal(comparisonOutcome(report), "uncertain");
      assert.equal(report.findings.length, 1);
      const finding = report.findings[0]!;
      assert.equal(finding.kind, "coverage");
      assert.equal(finding.tool, tool);
      assert.equal(finding.before.decision, "UNKNOWN");
      assert.equal(finding.after.decision, "UNKNOWN");
      for (const side of [finding.before, finding.after])
        assert.ok(side.evidence.some((e) => e.pointer === pointer));
      assert.ok(
        [...finding.before.evidence, ...finding.after.evidence].some(
          (e) => e.rule,
        ),
      );
      assert.equal(finding.explanation!.certainty, "uncertain");
    }
    const unchanged = policy({ defaultMode, ...rules });
    const report = comparePolicies(unchanged, unchanged);
    assert.deepEqual(report.findings, []);
    assert.equal(comparisonOutcome(report), "uncertain");
    assert.equal(assessComparisonGate(report, "high").exitCode, 3);
  }
});

test("defaultMode: changing only an unknown mode remains a coverage change", () => {
  const before = policy({ defaultMode: "auto", ...rules }, "before");
  const after = policy({ defaultMode: "future-mode", ...rules }, "after");
  const report = comparePolicies(before, after);
  assert.equal(report.findings.length, 1);
  const finding = report.findings[0]!;
  assert.equal(finding.kind, "coverage");
  assert.equal(finding.before.decision, "UNKNOWN");
  assert.equal(finding.after.decision, "UNKNOWN");
  assert.equal(finding.before.evidence[0]!.pointer, pointer);
  assert.equal(finding.after.evidence[0]!.pointer, pointer);
  assert.equal(comparisonOutcome(report), "uncertain");
});
