import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePolicies,
  evaluate,
  formatHuman,
  parsePolicy,
  scanPolicy,
  severity,
} from "../src/index.ts";
import { matches, regions } from "../src/glob.ts";

const file = ".claude/settings.json";
const policy = (permissions: unknown, revision = "test") =>
  parsePolicy(revision, { [file]: JSON.stringify({ permissions }) });

test("deny beats ask and allow regardless of specificity or ordering", () => {
  const p = policy({
    allow: ["Bash(npm test)"],
    ask: ["Bash(npm *)"],
    deny: ["Bash"],
  });
  assert.equal(evaluate(p, "Bash", "npm test").decision, "DENY");
  assert.equal(
    evaluate(p, "Bash", "npm test").evidence[0]!.pointer,
    "/permissions/deny/0",
  );
  assert.equal(
    evaluate(
      policy({ ask: ["Bash"], allow: ["Bash(npm test)"] }),
      "Bash",
      "npm test",
    ).decision,
    "ASK",
  );
});

test("lists merge across tracked local and shared settings", () => {
  const p = parsePolicy("rev", {
    [file]: JSON.stringify({
      permissions: { deny: ["Bash(npm *)"], allow: ["WebSearch"] },
    }),
    ".claude/settings.local.json": JSON.stringify({
      permissions: { allow: ["Bash(npm test)"] },
    }),
  });
  assert.equal(evaluate(p, "Bash", "npm test").decision, "DENY");
  assert.equal(evaluate(p, "WebSearch").decision, "ALLOW");
});

test("Bash wildcard boundaries, legacy suffix, middle and leading wildcard", () => {
  for (const raw of ["Bash(ls *)", "Bash(ls:*)"]) {
    const p = policy({ allow: [raw] });
    for (const input of ["ls", "ls -la"])
      assert.equal(evaluate(p, "Bash", input).decision, "ALLOW");
    assert.equal(evaluate(p, "Bash", "lsof").decision, "UNKNOWN");
  }
  assert.equal(
    evaluate(policy({ allow: ["Bash(ls*)"] }), "Bash", "lsof").decision,
    "ALLOW",
  );
  assert.equal(
    evaluate(
      policy({ allow: ["Bash(git * main)"] }),
      "Bash",
      "git push origin main",
    ).decision,
    "ALLOW",
  );
  assert.equal(
    evaluate(policy({ allow: ["Bash(* --help *)"] }), "Bash", "npm --help")
      .decision,
    "UNKNOWN",
  );
  assert.equal(
    evaluate(policy({ allow: ["Bash(* --help *)"] }), "Bash", "npm --help x")
      .decision,
    "ALLOW",
  );
});

test("unknown semantics are explicit and do not become a default allow or ask", () => {
  assert.equal(evaluate(policy({}), "Bash", "git status").decision, "UNKNOWN");
  assert.equal(evaluate(policy({}), "WebSearch").decision, "ASK");
  for (const permissions of [
    null,
    { allow: "Bash" },
    { defaultMode: "bypassPermissions", allow: ["Bash"] },
    { allow: ["Read(./.env)", "Bash"] },
    { allow: ["*", "Bash"] },
    { allow: [42] },
    { defaultMode: { toString: null } },
    JSON.parse('{"__proto__":[]}'),
  ]) {
    const p = policy(permissions);
    assert.ok(p.issues.length);
    assert.equal(evaluate(p, "Bash", "npm test").decision, "UNKNOWN");
  }
  for (const rule of [
    "Bash(run_in_background:true)",
    "Bash(echo hi && rm x)",
    "Bash(é)",
    "WebSearch(domain:x)",
  ]) {
    assert.ok(policy({ allow: [rule] }).issues.length);
  }
  assert.ok(parsePolicy("x", { [file]: "{" }).issues.length);
  assert.ok(parsePolicy("x", { [file]: "[]" }).issues.length);
  const hooks = parsePolicy("x", {
    [file]: JSON.stringify({
      hooks: { PreToolUse: [] },
      permissions: { allow: ["Bash"] },
    }),
  });
  assert.equal(evaluate(hooks, "Bash", "npm test").decision, "UNKNOWN");
});

test("duplicate, reordered, redundant, and masked permissions produce no effective diff", () => {
  const cases: [unknown, unknown][] = [
    [{ allow: ["Bash(npm:*)"] }, { allow: ["Bash(npm *)", "Bash(npm *)"] }],
    [
      { allow: ["Bash"], deny: ["Bash(npm *)"] },
      { allow: ["Bash", "Bash(npm test)"], deny: ["Bash(npm *)"] },
    ],
    [
      { deny: ["Bash"], allow: [] },
      { deny: ["Bash"], allow: ["Bash(git push *)"] },
    ],
    [
      { allow: ["Bash(npm test)", "WebSearch"] },
      { allow: ["WebSearch", "Bash(npm test)"] },
    ],
    [{ allow: ["Bash"] }, { allow: ["Bash(*)"] }],
  ];
  for (const [before, after] of cases)
    assert.deepEqual(
      comparePolicies(policy(before, "a"), policy(after, "b")).findings,
      [],
    );
});

test("finds wildcard widening beyond old exact permissions with replayable evidence", () => {
  const before = policy({ ask: ["Bash"], allow: ["Bash(npm test)"] }, "before");
  const after = policy(
    { ask: ["Bash(npm test)"], allow: ["Bash(npm *)"] },
    "after",
  );
  const report = comparePolicies(before, after);
  const change = report.findings.find(
    (f) => f.before.decision === "ASK" && f.after.decision === "ALLOW",
  );
  assert.ok(change);
  assert.equal(change.severity, "HIGH");
  assert.equal(
    evaluate(before, change.tool, change.witness).decision,
    change.before.decision,
  );
  assert.equal(
    evaluate(after, change.tool, change.witness).decision,
    change.after.decision,
  );
  assert.equal(change.before.evidence[0]!.revision, "before");
  assert.equal(change.after.evidence[0]!.file, file);
  assert.match(formatHuman(report), /Before:.*Bash/);
});

test("unsupported changes remain visible even UNKNOWN to UNKNOWN; values are not echoed", () => {
  const make = (value: unknown) =>
    parsePolicy("rev", { [file]: JSON.stringify({ hooks: value }) });
  const report = comparePolicies(make({ a: [1, 2] }), make({ a: [2, 1] }));
  assert.equal(report.findings[0]!.kind, "coverage");
  assert.equal(report.findings[0]!.severity, "MEDIUM");
  assert.deepEqual(
    comparePolicies(make({ a: 1, b: 2 }), make({ b: 2, a: 1 })).findings,
    [],
  );
  assert.ok(
    !JSON.stringify(make("sensitive-value")).includes("sensitive-value"),
  );
  assert.equal(scanPolicy(policy({ allow: ["Bash"] })).complete, false);
});

test("deterministic severity for all decision transitions", () => {
  const decisions = ["DENY", "ASK", "ALLOW", "UNKNOWN"] as const;
  const expected = [
    ["INFO", "MEDIUM", "HIGH", "MEDIUM"],
    ["LOW", "INFO", "HIGH", "MEDIUM"],
    ["LOW", "LOW", "INFO", "MEDIUM"],
    ["MEDIUM", "MEDIUM", "MEDIUM", "INFO"],
  ];
  for (const [i, a] of decisions.entries())
    for (const [j, b] of decisions.entries())
      assert.equal(severity(a, b), expected[i]![j]);
});

test("symbolic regions cover every acceptance signature in an independent finite oracle", () => {
  const patterns = ["*", "ab*", "a*b", "a* b*", "ab", "*b", "a**"];
  const oracle = (pattern: string, value: string): boolean => {
    if (pattern.length === 0) return value.length === 0;
    if (pattern[0] === "*")
      return (
        oracle(pattern.slice(1), value) ||
        (value.length > 0 && oracle(pattern, value.slice(1)))
      );
    return pattern[0] === value[0] && oracle(pattern.slice(1), value.slice(1));
  };
  const signature = (input: string) =>
    patterns.map((p) => oracle(p, input)).join(",");
  const found = new Set(regions(patterns).map(signature));
  let inputs = [""];
  for (let length = 1; length <= 5; length++) {
    inputs = inputs.flatMap((input) =>
      ["a", "b", " ", "x"].map((char) => input + char),
    );
    for (const input of inputs) {
      assert.ok(found.has(signature(input)), input);
      for (const pattern of patterns)
        assert.equal(matches(pattern, input), oracle(pattern, input));
    }
  }
  assert.ok(regions([]).every((witness) => witness.length > 0));
  assert.throws(() => regions(["abc"], 1), /exceeds/);
  assert.throws(() => regions(Array(129).fill("a")), /input limit/);
});
