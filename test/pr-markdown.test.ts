import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePolicies,
  formatPullRequestMarkdown,
  parsePolicy,
  scanPolicy,
  assessComparisonGate,
} from "../src/index.ts";

const policy = (revision: string, settings: object) =>
  parsePolicy(revision, { ".claude/settings.json": JSON.stringify(settings) });

test("PR Markdown distinguishes proven escalation and scoped gate", () => {
  const before = policy("before", { permissions: { ask: ["Bash(npm test)"] } });
  const after = policy("after", { permissions: { allow: ["Bash(npm test)"] } });
  const report = comparePolicies(before, after);
  report.gate = assessComparisonGate(report, "high");
  const markdown = formatPullRequestMarkdown(report);
  assert.match(markdown, /1 modeled decision change/);
  assert.match(markdown, /ASK \| ALLOW/);
  assert.match(markdown, /exit: 1/);
  assert.match(markdown, /complete: false/);
  assert.equal(report.gate.exitCode, 1);
});

test("PR Markdown preserves uncertainty without claiming pass", () => {
  const before = policy("before", {
    permissions: { allow: ["Bash(npm test)"] },
    hooks: {},
  });
  const after = policy("after", {
    permissions: { allow: ["Bash(npm *)"] },
    hooks: {},
  });
  const report = comparePolicies(before, after);
  const markdown = formatPullRequestMarkdown(report);
  assert.match(markdown, /Inspected-model uncertainty exists/);
  assert.match(markdown, /Coverage issues/);
  assert.match(markdown, /not certify/);
});

test("PR Markdown escapes hostile Markdown and HTML in witnesses and evidence", () => {
  const before = policy("before", { permissions: { ask: ["Bash(foo*bar)"] } });
  const after = policy("after", { permissions: { allow: ["Bash(foo*bar)"] } });
  const report = comparePolicies(before, after);
  report.findings[0]!.witness =
    "<script>|[click](https://evil.example)\n## fake";
  report.findings[0]!.before.evidence[0]!.rule =
    "</details><script>alert(1)</script>";
  const markdown = formatPullRequestMarkdown(report);
  assert.ok(!markdown.includes("<script>"));
  assert.ok(!markdown.includes("</details><script>"));
  assert.ok(!markdown.includes("\n## fake"));
  assert.match(markdown, /&lt;script&gt;/);
});

test("PR Markdown requires a comparison", () => {
  assert.throws(
    () => formatPullRequestMarkdown(scanPolicy(policy("a", { permissions: {} }))),
    /requires a compare report/,
  );
});
