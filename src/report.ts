import type { Evaluation, Report } from "./types.ts";
const quote = (value: string): string => JSON.stringify(value);
function evidence(value: Evaluation): string {
  return value.evidence.length
    ? value.evidence
        .map(
          (entry) =>
            `${entry.revision.slice(0, 12)}:${quote(entry.file)}#${quote(entry.pointer)}${entry.rule ? ` ${quote(entry.rule)}` : ""}`,
        )
        .join("; ")
    : "No determining rule";
}
export function formatHuman(report: Report): string {
  const lines = [
    "AgentPermissionDiff — Claude Code",
    `Scope: ${report.scope}; runtime authorization is not established.`,
    `Revisions: ${report.revisions.join(" → ")}`,
    "Coverage: partial (see README for assumptions and unsupported runtime semantics)",
  ];
  if (!report.findings.length)
    lines.push("No effective changes in the modeled rule policy.");
  for (const finding of report.findings) {
    lines.push(
      `\n[${finding.severity}] ${finding.kind} ${quote(finding.tool)} ${quote(finding.witness)}: ${finding.before.decision} → ${finding.after.decision}`,
      `  Before: ${evidence(finding.before)}; ${finding.before.reason}`,
      `  After:  ${evidence(finding.after)}; ${finding.after.reason}`,
    );
  }
  for (const policy of report.policies)
    for (const issue of policy.issues) {
      lines.push(
        `Coverage issue ${policy.revision.slice(0, 12)}:${quote(issue.evidence.file)}#${quote(issue.evidence.pointer)}: ${quote(issue.message)}`,
      );
    }
  return lines.join("\n") + "\n";
}
