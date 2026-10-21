// Compile the same external TypeScript consumer against published v0.3.0
// and the current candidate's declaration entrypoint. No analyzed policy executes.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

const stablePrefix = process.env.RULEWITNESS_STABLE_ROOT;
assert.ok(stablePrefix, "Missing stable install prefix");
const stable = resolve(stablePrefix, "node_modules/rulewitness/dist/index.d.ts");
const candidate = resolve("dist/index.d.ts");
const folder = mkdtempSync(join(tmpdir(), "rulewitness-ts-compat-"));
const fixture = join(folder, "consumer.ts");
const consumer = `
import {
  parsePolicy, scanPolicy, comparePolicies, evaluate, severity,
  formatMarkdown, formatHuman, explainFinding, validateWitness,
  comparisonOutcome, assessComparisonGate, hasUncertainty,
  parseTestConfig, runPolicyTests,
  type Report, type Decision, type ComparisonGate, type PolicyTestReport,
} from "rulewitness";
const policy = parsePolicy("commit", {});
const scan: Report = scanPolicy(policy);
const compare: Report = comparePolicies(policy, policy);
const decision: Decision = evaluate(policy, "Bash", "npm test").decision;
const gate: ComparisonGate = assessComparisonGate(compare, "high");
const policyTests: PolicyTestReport = runPolicyTests(
  policy,
  parseTestConfig(JSON.stringify({
    schemaVersion: 1,
    cases: [{ name: "test", tool: "Bash", input: "npm test", expected: "UNKNOWN" }],
  })),
);
void [scan, decision, gate, policyTests, severity, formatMarkdown,
  formatHuman, explainFinding, validateWitness, comparisonOutcome,
  hasUncertainty];
`;
try {
  writeFileSync(fixture, consumer);
  let stableExports = [];
  for (const [label, declarations] of [["published-0.3.0", stable], ["candidate", candidate]]) {
    const options = {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2024,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      baseUrl: folder,
      paths: { rulewitness: [declarations] },
      types: ["node"],
      skipLibCheck: false,
    };
    const program = ts.createProgram([fixture], options);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const errors = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    assert.deepEqual(errors, [], label + " declaration errors");
    const source = program.getSourceFile(declarations);
    assert.ok(source, label + " declaration entrypoint missing");
    const checker = program.getTypeChecker();
    const moduleSymbol = checker.getSymbolAtLocation(source);
    assert.ok(moduleSymbol, label + " module symbol missing");
    const names = checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.getName());
    if (label === "published-0.3.0") {
      stableExports = names;
    } else {
      const missing = stableExports.filter((name) => !names.includes(name));
      assert.deepEqual(missing, [], "Removed stable declaration exports");
    }
  }
  process.stdout.write("TypeScript declaration consumer compatibility: PASS\n");
} finally {
  rmSync(folder, { recursive: true, force: true });
}
