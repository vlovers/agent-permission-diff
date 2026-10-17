import type {
  ComparisonOutcome,
  Explanation,
  Finding,
  Policy,
  Report,
  SeverityThreshold,
} from "./types.ts";
import { evaluate } from "./policy.ts";

export const LIMITATIONS = Object.freeze([
  "Supported configured-rule semantics only; runtime authorization is not guaranteed.",
  "External settings, session state, shell normalization and runtime checks are not established by this report.",
] as const);

export function explainFinding(finding: Finding): Explanation {
  const uncertain =
    finding.kind === "coverage" ||
    finding.before.decision === "UNKNOWN" ||
    finding.after.decision === "UNKNOWN";
  return {
    certainty: uncertain ? "uncertain" : "modeled",
    summary:
      finding.kind === "coverage"
        ? "Unresolved configuration changed or masks changed rules; semantic equivalence cannot be established."
        : finding.before.decision === finding.after.decision
          ? `Inventory: the modeled decision is ${finding.after.decision}.`
          : `The modeled decision for this witness changes from ${finding.before.decision} to ${finding.after.decision}.${uncertain ? " At least one side is unknown; this is not a proven escalation." : ""}`,
    steps: [
      `Before: ${finding.before.reason}`,
      `After: ${finding.after.reason}`,
    ],
    limitations: [...LIMITATIONS],
  };
}

/** Replays a transition witness; coverage messages and scan inventory are not witnesses. */
export function validateWitness(
  before: Policy,
  after: Policy,
  finding: Finding,
): boolean {
  return (
    finding.kind === "permission" &&
    finding.before.decision !== finding.after.decision &&
    JSON.stringify(evaluate(before, finding.tool, finding.witness)) ===
      JSON.stringify(finding.before) &&
    JSON.stringify(evaluate(after, finding.tool, finding.witness)) ===
      JSON.stringify(finding.after)
  );
}

export function comparisonOutcome(report: Report): ComparisonOutcome {
  if (report.command !== "compare")
    throw new Error("Comparison outcome requires a compare report");
  if (hasUncertainty(report)) return "uncertain";
  return report.findings.length ? "modeled-change" : "modeled-no-op";
}

export function hasUncertainty(report: Report): boolean {
  return (
    report.policies.some((policy) => policy.issues.length > 0) ||
    report.findings.some(
      (finding) =>
        finding.kind === "coverage" ||
        finding.before.decision === "UNKNOWN" ||
        finding.after.decision === "UNKNOWN",
    )
  );
}

/** Opt-in gate for the inspected model, not a full runtime security pass. */
export function comparisonExitCode(
  report: Report,
  threshold?: SeverityThreshold,
): 0 | 1 | 3 {
  if (threshold === undefined) return 0;
  if (report.command !== "compare")
    throw new Error("Severity thresholds apply only to compare");
  if (!["high", "medium", "low", "info"].includes(threshold))
    throw new Error("Invalid severity threshold");
  if (hasUncertainty(report)) return 3;
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 } as const;
  return report.findings.some(
    (finding) =>
      finding.kind === "permission" &&
      finding.before.decision !== finding.after.decision &&
      rank[finding.severity] >=
        rank[threshold.toUpperCase() as keyof typeof rank],
  )
    ? 1
    : 0;
}
