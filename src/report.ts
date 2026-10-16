import type { Evaluation, Report } from "./types.ts";
const quote = (value: string): string =>
  JSON.stringify(value).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) => {
    const point = char.codePointAt(0)!;
    return point <= 0xffff
      ? `\\u${point.toString(16).padStart(4, "0")}`
      : `\\u{${point.toString(16)}}`;
  });
function evidence(value: Evaluation): string {
  return value.evidence.length
    ? value.evidence
        .map(
          (entry) =>
            `${quote(entry.revision.slice(0, 12))}:${quote(entry.file)}#${quote(entry.pointer)}${entry.rule ? ` ${quote(entry.rule)}` : ""}`,
        )
        .join("; ")
    : "No determining rule";
}
export function formatHuman(report: Report): string {
  const lines = [
    "AgentPermissionDiff — Claude Code",
    `Scope: ${report.scope}; runtime authorization is not established.`,
    `Revisions: ${report.revisions.map(quote).join(" → ")}`,
    "Coverage: partial (see README for assumptions and unsupported runtime semantics)",
  ];
  if (!report.findings.length)
    lines.push(
      report.policies.some((policy) => policy.issues.length)
        ? "No decision changes established; unresolved configuration prevents an unchanged-policy conclusion."
        : "No decision changes found within the supported rule model; runtime behavior remains unverified.",
    );
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
        `Coverage issue ${quote(policy.revision.slice(0, 12))}:${quote(issue.evidence.file)}#${quote(issue.evidence.pointer)}: ${quote(issue.message)}`,
      );
    }
  return lines.join("\n") + "\n";
}
