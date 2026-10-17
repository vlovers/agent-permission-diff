import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import test from "node:test";
import {
  comparePolicies,
  comparisonExitCode,
  comparisonOutcome,
  evaluate,
  explainFinding,
  formatHuman,
  formatMarkdown,
  hasUncertainty,
  parsePolicy,
  parseTestConfig,
  readTestConfig,
  relevantIssues,
  runPolicyTests,
  scanPolicy,
  validateWitness,
} from "../src/index.ts";
import type { Decision, Finding } from "../src/index.ts";
const file = ".claude/settings.json";
const policy = (permissions: unknown, extra: object = {}, revision = "r") =>
  parsePolicy(revision, { [file]: JSON.stringify({ ...extra, permissions }) });
const config = (
  expected: Decision = "ALLOW",
  tool = "Bash",
  input = "npm test",
) =>
  parseTestConfig(
    JSON.stringify({
      schemaVersion: 1,
      cases: [{ name: "Case", tool, input, expected }],
    }),
  );

test("explanations are evidence-derived, additive, versioned and replayable", () => {
  const before = policy({ ask: ["Bash(npm run build)"] }, {}, "before");
  const after = policy({ allow: ["Bash(npm run build)"] }, {}, "after");
  const report = comparePolicies(before, after);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.findings.length, 1);
  const finding = report.findings[0]!;
  assert.deepEqual(finding.explanation, explainFinding(finding));
  assert.equal(finding.explanation!.certainty, "modeled");
  assert.deepEqual(finding.explanation!.steps, [
    `Before: ${finding.before.reason}`,
    `After: ${finding.after.reason}`,
  ]);
  assert.ok(
    finding.explanation!.limitations.some((s) =>
      s.includes("runtime authorization is not guaranteed"),
    ),
  );
  assert.equal(validateWitness(before, after, finding), true);
  const tampered: Finding = JSON.parse(JSON.stringify(finding));
  tampered.witness = "npm test";
  assert.equal(validateWitness(before, after, tampered), false);
  assert.equal(comparisonOutcome(report), "modeled-change");
});

test("noise filtering proves normalized, redundant, overlapping and shadowed cases", () => {
  const pairs = [
    [{ allow: ["Bash(npm *)"] }, { allow: ["Bash(npm:*)", "Bash(npm test)"] }],
    [{ allow: ["Bash(a*b)"] }, { allow: ["Bash(a**b)"] }],
    [
      { deny: ["Bash(npm *)"], allow: ["Bash"] },
      { deny: ["Bash(npm *)"], allow: ["Bash", "Bash(npm run build)"] },
    ],
    [
      { ask: ["Bash(npm *)"], allow: ["Bash(npm test)"] },
      { ask: ["Bash(npm *)"], allow: [] },
    ],
    [
      { deny: ["Bash"], allow: ["Bash(npm *)", "WebSearch"] },
      { deny: ["Bash"], allow: ["WebSearch", "Bash(npm:*)", "Bash(npm *)"] },
    ],
  ];
  for (const [a, b] of pairs) {
    const report = comparePolicies(policy(a), policy(b));
    assert.deepEqual(report.findings, []);
    assert.equal(comparisonOutcome(report), "modeled-no-op");
  }
});

test("wildcard widening emits deterministic, replay-valid counterexamples including uncertain defaults", () => {
  const before = policy({ allow: ["Bash(npm test)"] });
  const after = policy({ allow: ["Bash(npm *)"] });
  const report = comparePolicies(before, after);
  assert.ok(report.findings.length);
  for (const finding of report.findings) {
    assert.equal(validateWitness(before, after, finding), true);
    assert.notEqual(finding.witness, "npm test");
    assert.equal(finding.before.decision, "UNKNOWN");
    assert.equal(finding.after.decision, "ALLOW");
    assert.equal(finding.explanation!.certainty, "uncertain");
  }
  assert.equal(comparisonOutcome(report), "uncertain");
  assert.equal(comparisonExitCode(report, "high"), 3);
  assert.equal(
    JSON.stringify(report),
    JSON.stringify(comparePolicies(before, after)),
  );
});

test("stable unknowns never become proven equivalence and coverage evidence is deduplicated", () => {
  const before = policy({ deny: ["Bash(git push *)"] }, { hooks: {} });
  const after = policy(
    { deny: ["Bash(git push *)"], allow: ["Bash(npm test)"] },
    { hooks: {} },
  );
  const report = comparePolicies(before, after);
  assert.ok(report.findings.some((f) => f.kind === "coverage"));
  assert.equal(comparisonOutcome(report), "uncertain");
  assert.ok(relevantIssues(before, "Bash").length);
  for (const finding of report.findings) {
    assert.equal(finding.explanation!.certainty, "uncertain");
    assert.equal(
      new Set(finding.before.evidence.map((e) => JSON.stringify(e))).size,
      finding.before.evidence.length,
    );
    assert.equal(validateWitness(before, after, finding), false);
  }
  assert.equal(comparisonExitCode(comparePolicies(before, before), "high"), 3);
});

test("severity gates distinguish threshold, uncertainty and legacy report-only behavior", () => {
  for (const [a, b, high, medium, low] of [
    ["ASK", "ALLOW", 1, 1, 1],
    ["DENY", "ASK", 0, 1, 1],
    ["ALLOW", "DENY", 0, 0, 1],
  ] as const) {
    const before = policy({ [a.toLowerCase()]: ["Bash"] });
    const after = policy({ [b.toLowerCase()]: ["Bash"] });
    const report = comparePolicies(before, after);
    assert.equal(comparisonExitCode(report), 0);
    assert.equal(comparisonExitCode(report, "high"), high);
    assert.equal(comparisonExitCode(report, "medium"), medium);
    assert.equal(comparisonExitCode(report, "low"), low);
    assert.equal(comparisonExitCode(report, "info"), 1);
  }
  const report = comparePolicies(
    policy({ deny: ["Bash"] }),
    policy({ deny: ["Bash"] }),
  );
  assert.equal(comparisonExitCode(report, "info"), 0);
  assert.equal(hasUncertainty(report), false);
  assert.equal(report.complete, false); // Scope limits do not disappear in gated mode.
  assert.throws(
    () => comparisonExitCode(scanPolicy(policy({})), "high"),
    /only to compare/,
  );
});

test("policy-test parser validates every field, duplicate names and schema bounds", () => {
  const base = JSON.parse(JSON.stringify(config()));
  const invalid = [
    null,
    [],
    {},
    { ...base, schemaVersion: 2 },
    { ...base, cases: [] },
    { ...base, cases: Array(1001).fill(base.cases[0]) },
    { ...base, typo: true },
    { ...base, cases: [base.cases[0], base.cases[0]] },
  ];
  for (const field of [
    { name: "" },
    { name: "x".repeat(201) },
    { tool: "" },
    { input: "" },
    { input: "x".repeat(4001) },
    { expected: "allow" },
    { expected: true },
    { typo: "ALLOW" },
  ])
    invalid.push({ ...base, cases: [{ ...base.cases[0], ...field }] });
  for (const value of invalid)
    assert.throws(() => parseTestConfig(JSON.stringify(value)));
  assert.throws(() => parseTestConfig("{"), /valid JSON/);
  assert.throws(() => parseTestConfig(" ".repeat(1024 * 1024 + 1)), /1 MiB/);
  assert.deepEqual(parseTestConfig(JSON.stringify(base)), base);
});

test("assertions show expected/actual decisions and determining evidence without executing input", () => {
  const p = policy({ allow: ["Bash(npm test)"], deny: ["Bash(git push *)"] });
  const result = runPolicyTests(p, config());
  assert.equal(result.passed, true);
  assert.equal(
    result.results[0]!.actual.evidence[0]!.pointer,
    "/permissions/allow/0",
  );
  assert.equal(result.complete, false);
  assert.equal(
    runPolicyTests(p, config("DENY")).results[0]!.status,
    "mismatch",
  );
  assert.equal(
    runPolicyTests(p, config("DENY", "Bash", "git push origin main")).passed,
    true,
  );
  assert.equal(
    runPolicyTests(p, config("UNKNOWN", "Unmodeled", "anything")).passed,
    false,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.match(formatHuman(result), /Expected: ALLOW; Actual: ALLOW/);
});

test("unknown assertions always fail, including expected UNKNOWN and broad raw allows", () => {
  for (const expected of ["ALLOW", "ASK", "DENY", "UNKNOWN"] as const) {
    const result = runPolicyTests(policy({}), config(expected));
    assert.equal(result.passed, false);
    assert.equal(result.results[0]!.status, "unknown");
  }
  for (const input of [
    "npm test && touch SHOULD_NOT_RUN",
    "echo $(pwd)",
    "echo hi > output",
    "timeout 2 npm test",
    "FOO=bar npm test",
    "find . -delete",
    "echo 'hi'",
    "echo *",
    " npm test",
    "npm test\n",
  ]) {
    const result = runPolicyTests(
      policy({ allow: ["Bash"] }),
      config("ALLOW", "Bash", input),
    );
    assert.equal(result.passed, false, input);
    assert.equal(result.results[0]!.actual.decision, "UNKNOWN", input);
    assert.deepEqual(result.results[0]!.actual.evidence, []);
  }
  assert.equal(
    runPolicyTests(policy({ allow: ["Bash"] }, { hooks: {} }), config()).passed,
    false,
  );
});

test("test-data loader rejects missing, oversized, malformed and escaping symlink inputs", () => {
  const directory = mkdtempSync(resolve(".apd-test-config-"));
  const repo = join(directory, "repo");
  mkdirSync(repo);
  try {
    writeFileSync(
      join(repo, "rulewitness.tests.json"),
      JSON.stringify(config()),
    );
    assert.deepEqual(readTestConfig(repo), config());
    writeFileSync(join(directory, "outside.json"), JSON.stringify(config()));
    assert.throws(
      () => readTestConfig(repo, "../outside.json"),
      /inside the repository/,
    );
    symlinkSync("../outside.json", join(repo, "escape.json"));
    assert.throws(
      () => readTestConfig(repo, "escape.json"),
      /inside the repository/,
    );
    symlinkSync("rulewitness.tests.json", join(repo, "link.json"));
    assert.throws(() => readTestConfig(repo, "link.json"), /regular file/);
    writeFileSync(join(repo, "huge.json"), "x".repeat(1024 * 1024 + 1));
    assert.throws(() => readTestConfig(repo, "huge.json"), /1 MiB/);
    writeFileSync(join(repo, "invalid.json"), Buffer.from([0xff]));
    assert.throws(() => readTestConfig(repo, "invalid.json"));
    assert.throws(() => readTestConfig(repo, "."), /inside the repository/);
    assert.throws(() => readTestConfig(repo, "missing.json"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("assertion work limits fail explicitly rather than returning a partial pass", () => {
  const p = policy({
    allow: Array.from(
      { length: 100 },
      (_, i) => `Bash(cmd${i}${"x".repeat(100)})`,
    ),
  });
  assert.throws(
    () => runPolicyTests(p, config("ALLOW", "Bash", "x".repeat(4000))),
    /work limit/,
  );
});

test("Markdown encloses hostile configuration data in a non-escapable fence", () => {
  const p = policy({}, { "evil\n```\n<img src=x onerror=evil>\n````": true });
  const output = formatMarkdown(scanPolicy(p));
  const fence = output.split("\n")[2]!;
  assert.equal(fence, "`````text");
  assert.ok(output.endsWith("`````\n"));
  assert.match(output, /runtime authorization is not guaranteed/);
  const hostile = scanPolicy(policy({ allow: ["Bash"] }));
  hostile.findings[0]!.tool = "Bash\u001b[31m";
  assert.ok(!formatHuman(hostile).includes("\u001b"));
});
