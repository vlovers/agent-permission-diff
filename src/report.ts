import { comparisonOutcome, explainFinding, LIMITATIONS } from "./explain.ts";
import type { Evaluation, PolicyTestReport, Report } from "./types.ts";

export const safeText = (value: string): string =>
  value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) => {
    const point = char.codePointAt(0)!;
    return point <= 0xffff
      ? `\\u${point.toString(16).padStart(4, "0")}`
      : `\\u{${point.toString(16)}}`;
  });
const quote = (value: string): string => safeText(JSON.stringify(value));
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

export function formatHuman(report: Report | PolicyTestReport): string {
  const title =
    report.command === "test"
      ? "Policy Tests"
      : report.command === "compare"
        ? "Permission Diff"
        : "Permission Inventory";
  const lines = [
    `RuleWitness — ${title}`,
    `Scope: ${report.scope}; runtime authorization is not established.`,
    `Revisions: ${(report.command === "test" ? [report.revision] : report.revisions).map(quote).join(" → ")}`,
    "Coverage: partial (see README for assumptions and unsupported runtime semantics)",
  ];
  if (report.command === "test") {
    lines.push(
      `Assertions: ${report.passed ? "passed" : "failed"} (${report.results.filter((r) => r.status === "passed").length}/${report.results.length})`,
    );
    for (const result of report.results) {
      lines.push(
        `\n[${result.status.toUpperCase()}] ${quote(result.name)}: ${quote(result.tool)} ${quote(result.input)}`,
        `  Expected: ${result.expected}; Actual: ${result.actual.decision}`,
        `  Why: ${safeText(result.actual.reason)}`,
        `  Evidence: ${evidence(result.actual)}`,
      );
    }
    for (const issue of report.issues)
      lines.push(
        `Coverage issue ${quote(issue.evidence.file)}#${quote(issue.evidence.pointer)}: ${quote(issue.message)}`,
      );
  } else {
    if (report.command === "compare")
      lines.push(
        `Outcome: ${comparisonOutcome(report)} (within the inspected model only)`,
      );
    if (!report.findings.length)
      lines.push(
        report.policies.some((p) => p.issues.length)
          ? "No decision changes established; unresolved configuration prevents an unchanged-policy conclusion."
          : "No decision changes found within the supported rule model; runtime behavior remains unverified.",
      );
    for (const finding of report.findings) {
      const explanation = explainFinding(finding);
      lines.push(
        `\n[${finding.severity}] ${finding.kind} ${quote(finding.tool)} ${quote(finding.witness)}: ${finding.before.decision} → ${finding.after.decision}`,
        `  Before: ${finding.before.decision}`,
        `  After:  ${finding.after.decision}`,
        `  Why: ${safeText(explanation.summary)}`,
        ...explanation.steps.map((step) => `    ${safeText(step)}`),
        "  Evidence:",
        `    Before: ${evidence(finding.before)}; ${safeText(finding.before.reason)}`,
        `    After:  ${evidence(finding.after)}; ${safeText(finding.after.reason)}`,
      );
      if (finding.kind === "permission")
        lines.push(
          `  Witness: ${safeText(finding.tool)}(${quote(finding.witness)})`,
        );
    }
    for (const policy of report.policies)
      for (const issue of policy.issues)
        lines.push(
          `Coverage issue ${quote(policy.revision.slice(0, 12))}:${quote(issue.evidence.file)}#${quote(issue.evidence.pointer)}: ${quote(issue.message)}`,
        );
  }
  lines.push("", ...LIMITATIONS);
  return lines.join("\n") + "\n";
}

/** Fence length is derived from the data so hostile Markdown cannot escape it. */
export function formatMarkdown(report: Report | PolicyTestReport): string {
  const human = formatHuman(report);
  const longest = [...human.matchAll(/`+/g)].reduce(
    (max, match) => Math.max(max, match[0].length),
    0,
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `# RuleWitness — ${report.command === "test" ? "Policy Tests" : "Permission Report"}\n\n${fence}text\n${human}${fence}\n`;
}
