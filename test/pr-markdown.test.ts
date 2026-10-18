import assert from "node:assert/strict";
import test from "node:test";
import {
  assessComparisonGate,
  comparePolicies,
  formatPullRequestMarkdown,
  parsePolicy,
  scanPolicy,
} from "../src/index.ts";

const policy = (revision: string, permissions: object, hooks = false) =>
  parsePolicy(revision, {
    ".claude/settings.json": JSON.stringify({
      permissions,
      ...(hooks ? { hooks: {} } : {}),
    }),
  });

test("PR report distinguishes proven escalation and gate result", () => {
  const before = policy("before", { ask: ["Bash(npm test)"] });
  const after = policy("after", { allow: ["Bash(npm test)"] });
  const report = comparePolicies(before, after);
  report.gate = assessComparisonGate(report, "high");
  const markdown = formatPullRequestMarkdown(report);
  assert.match(markdown, /1 modeled decision change/);
  assert.match(markdown, /ASK \| ALLOW/);
  assert.match(markdown, /exit: 1/);
  assert.match(markdown, /complete: false/);
});

test("PR report preserves uncertainty and coverage issues", () => {
  const before = policy("before", { allow: ["Bash(npm test)"] }, true);
  const after = policy("after", { allow: ["Bash(npm *)"] }, true);
  const markdown = formatPullRequestMarkdown(comparePolicies(before, after));
  assert.match(markdown, /Inspected-model uncertainty exists/);
  assert.match(markdown, /Coverage issues/);
  assert.match(markdown, /not certify/);
});

test("PR report escapes hostile Markdown and HTML", () => {
  const before = policy("before", { ask: ["Bash(foo*bar)"] });
  const after = policy("after", { allow: ["Bash(foo*bar)"] });
  const report = comparePolicies(before, after);
  const finding = report.findings[0]!;
  finding.witness = "<script>|[click](https://evil.example)\n## fake";
  finding.before.evidence[0]!.rule = "</details><script>";
  const markdown = formatPullRequestMarkdown(report);
  assert.ok(!markdown.includes("<script>"));
  assert.ok(!markdown.includes("</details><script>"));
  assert.ok(!markdown.includes("\n## fake"));
  assert.match(markdown, /&lt;script&gt;/);
});

test("PR report rejects scan inventory", () => {
  const report = scanPolicy(policy("a", {}));
  assert.throws(
    () => formatPullRequestMarkdown(report),
    /requires a compare report/,
  );
});
