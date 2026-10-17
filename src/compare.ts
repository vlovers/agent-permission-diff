import { regions } from "./glob.ts";
import { evaluate, relevantIssues, uniqueEvidence } from "./policy.ts";
import { explainFinding, validateWitness } from "./explain.ts";
import type {
  Decision,
  Evaluation,
  Finding,
  Policy,
  Report,
  Severity,
} from "./types.ts";

export function severity(before: Decision, after: Decision): Severity {
  if (before === after) return "INFO";
  if (before === "UNKNOWN" || after === "UNKNOWN") return "MEDIUM";
  if (after === "ALLOW") return "HIGH";
  if (before === "DENY" && after === "ASK") return "MEDIUM";
  return "LOW";
}
const tools = ["Bash", "WebSearch"];
function witnesses(before: Policy, after: Policy, tool: string): string[] {
  if (tool !== "Bash") return ["*"];
  const patterns = [
    ...new Set(
      [...before.rules, ...after.rules]
        .filter((rule) => rule.tool === tool)
        .map((rule) => rule.pattern),
    ),
  ].sort();
  return regions(patterns);
}
export function comparePolicies(before: Policy, after: Policy): Report {
  const findings: Finding[] = [];
  for (const tool of tools) {
    const seen = new Set<string>();
    for (const witness of witnesses(before, after, tool)) {
      const left = evaluate(before, tool, witness),
        right = evaluate(after, tool, witness);
      if (left.decision === right.decision) continue;
      // One witness per transition and determining evidence, rather than per NFA state.
      const key = JSON.stringify([left, right]);
      if (seen.has(key)) continue;
      seen.add(key);
      const finding: Finding = {
        kind: "permission",
        tool,
        witness,
        severity: severity(left.decision, right.decision),
        before: left,
        after: right,
      };
      if (!validateWitness(before, after, finding))
        throw new Error("Generated witness failed evaluator replay");
      findings.push(finding);
    }
    // UNKNOWN is missing knowledge, not a semantic equivalence class. A
    // stable hook/mode/unsupported rule must not hide changed known rules.
    const ruleKeys = (policy: Policy): string[] =>
      [
        ...new Set(
          policy.rules
            .filter((rule) => rule.tool === tool)
            .map((rule) => JSON.stringify([rule.pattern, rule.decision])),
        ),
      ].sort();
    if (
      (relevantIssues(before, tool).length ||
        relevantIssues(after, tool).length) &&
      JSON.stringify(ruleKeys(before)) !== JSON.stringify(ruleKeys(after))
    ) {
      const unresolved = (policy: Policy): Evaluation => ({
        decision: "UNKNOWN",
        reason:
          "Supported rules changed under unresolved configuration; unchanged behavior cannot be established",
        evidence: uniqueEvidence([
          ...relevantIssues(policy, tool).map((issue) => issue.evidence),
          ...policy.rules
            .filter((rule) => rule.tool === tool)
            .map((rule) => rule.evidence),
        ]),
      });
      findings.push({
        kind: "coverage",
        tool,
        witness: "Supported rules changed under unresolved configuration",
        severity: "MEDIUM",
        before: unresolved(before),
        after: unresolved(after),
      });
    }
  }
  const issueKeys = (policy: Policy): string[] =>
    [
      ...new Set(
        policy.issues.map((issue) =>
          JSON.stringify([
            issue.evidence.file,
            issue.evidence.pointer.replace(
              /^(\/permissions\/(?:allow|ask|deny))\/\d+$/,
              "$1",
            ),
            issue.tool,
            issue.fingerprint,
          ]),
        ),
      ),
    ].sort();
  if (JSON.stringify(issueKeys(before)) !== JSON.stringify(issueKeys(after))) {
    const unknown = (policy: Policy): Evaluation => ({
      decision: "UNKNOWN",
      reason: "Unsupported configuration changed; review coverage diagnostics",
      evidence: policy.issues.map((issue) => issue.evidence),
    });
    findings.push({
      kind: "coverage",
      tool: "*",
      witness: "Unmodeled configuration",
      severity: "MEDIUM",
      before: unknown(before),
      after: unknown(after),
    });
  }
  return report("compare", [before, after], findings);
}
export function scanPolicy(policy: Policy): Report {
  const findings: Finding[] = [];
  for (const tool of tools) {
    const seen = new Set<string>();
    for (const witness of witnesses(policy, policy, tool)) {
      const result = evaluate(policy, tool, witness);
      const key = JSON.stringify(result);
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        kind: "permission",
        tool,
        witness,
        severity: "INFO",
        before: result,
        after: result,
      });
    }
  }
  return report("scan", [policy], findings);
}
function report(
  command: "scan" | "compare",
  policies: Policy[],
  findings: Finding[],
): Report {
  return {
    schemaVersion: 1,
    provider: "claude-code",
    scope: "tracked-project-rule-policy",
    command,
    revisions: policies.map((policy) => policy.revision),
    complete: false,
    findings: findings.map((finding) => ({
      ...finding,
      explanation: explainFinding(finding),
    })),
    policies,
  };
}
