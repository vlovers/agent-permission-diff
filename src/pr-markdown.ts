import { explainFinding, hasUncertainty, LIMITATIONS } from "./explain.ts";
import type { Evaluation, Finding, Report } from "./types.ts";

/** Escape every GitHub Markdown metacharacter and raw HTML delimiter. */
function cell(value: string): string {
  return value
    .replace(/[&<>|\`*_{}\[\]()!#~]/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      return "\\" + char;
    })
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "?");
}

function details(value: Evaluation): string[] {
  return value.evidence.length
    ? value.evidence.map((entry) =>
        [
          entry.revision.slice(0, 12),
          entry.file,
          entry.pointer,
          entry.rule ?? "",
        ]
          .filter(Boolean)
          .join(" · "),
      )
    : ["No determining rule"];
}

function findingTable(findings: Finding[]): string[] {
  if (findings.length === 0) return ["No findings in this category."];
  return [
    "| Severity | Tool | Witness | Before | After |",
    "| --- | --- | --- | --- | --- |",
    ...findings.map(
      (finding) =>
        `| ${finding.severity} | ${cell(finding.tool)} | ${cell(finding.witness)} | ${finding.before.decision} | ${finding.after.decision} |`,
    ),
  ];
}

/**
 * Reviewer-focused, inert Markdown for supported compare reports.
 * This is a presentation layer, not an authorization or policy decision.
 */
export function formatPullRequestMarkdown(report: Report): string {
  if (report.command !== "compare")
    throw new Error("PR Markdown requires a compare report");
  const known = report.findings.filter(
    (finding) =>
      finding.kind === "permission" &&
      finding.before.decision !== "UNKNOWN" &&
      finding.after.decision !== "UNKNOWN",
  );
  const uncertain = report.findings.filter(
    (finding) => !known.includes(finding),
  );
  const issues = report.policies.flatMap((policy) => policy.issues);
  const lines = [
    "# RuleWitness — PR permission review",
    "",
    "**Scope:** tracked project permission rules only; not runtime authorization.",
    "",
    `**Revisions:** ${cell(report.revisions.join(" → "))}`,
    "",
    `**Summary:** ${known.length} modeled decision change(s), ${uncertain.length} uncertain finding(s), ${issues.length} coverage issue(s).`,
    "",
    `**Coverage:** partial (\`complete: false\`). ${hasUncertainty(report) ? "Inspected-model uncertainty exists." : "No inspected-model uncertainty detected."}`,
    "",
    "## Known modeled changes",
    "",
    ...findingTable(known),
    "",
    "## Uncertain findings",
    "",
    ...findingTable(uncertain),
    "",
    "## Evidence",
    "",
  ];
  for (const [index, finding] of report.findings.entries()) {
    const explanation = explainFinding(finding);
    lines.push(
      `<details><summary>Finding ${index + 1}: ${finding.severity} · ${cell(finding.tool)} · ${finding.before.decision} → ${finding.after.decision}</summary>`,
      "",
      cell(explanation.summary),
      "",
      "**Before**",
      "",
      ...details(finding.before).map((value) => `- ${cell(value)}`),
      "",
      "**After**",
      "",
      ...details(finding.after).map((value) => `- ${cell(value)}`),
      "",
      "</details>",
      "",
    );
  }
  if (issues.length) {
    lines.push("## Coverage issues", "");
    for (const issue of issues) {
      lines.push(
        `- ${cell(issue.evidence.revision.slice(0, 12))} · ${cell(issue.evidence.file)} · ${cell(issue.evidence.pointer)}: ${cell(issue.message)}`,
      );
    }
    lines.push("");
  }
  if (report.gate) {
    lines.push(
      "## Scoped CI gate",
      "",
      `Threshold: ${report.gate.threshold}; violation: ${report.gate.thresholdExceeded}; uncertainty: ${report.gate.uncertain}; exit: ${report.gate.exitCode}.`,
      "",
    );
  }
  lines.push(
    "## Limitations",
    "",
    ...LIMITATIONS.map((value) => `- ${cell(value)}`),
    "- An empty report or exit code 0 does not certify Claude Code runtime security.",
    "",
  );
  return lines.join("\n");
}
