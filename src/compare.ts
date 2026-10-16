import { regions } from "./glob.ts";
import { evaluate } from "./policy.ts";
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
      findings.push({
        kind: "permission",
        tool,
        witness,
        severity: severity(left.decision, right.decision),
        before: left,
        after: right,
      });
    }
  }
  const issueKeys = (policy: Policy): string[] =>
    [
      ...new Set(
        policy.issues.map((issue) =>
          JSON.stringify([
            issue.evidence.file,
            issue.evidence.pointer.replace(/\/\d+$/, ""),
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
    findings,
    policies,
  };
}
