import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const bug = read(".github/ISSUE_TEMPLATE/bug_report.md");
const task = read(".github/ISSUE_TEMPLATE/engineering_task.md");
const security = read("SECURITY.md");
const contributing = read("CONTRIBUTING.md");

function frontmatter(markdown: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  assert.ok(match, "GitHub Issue template must start with YAML frontmatter");
  const entries = match[1]!.split("\n").map((line) => {
    const pair = /^([a-z_]+):\s*(.+)$/.exec(line);
    assert.ok(pair, `Invalid frontmatter entry: ${line}`);
    return [pair[1]!, pair[2]!.replace(/^"|"$/g, "")] as const;
  });
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
  return Object.fromEntries(entries);
}

test("both GitHub Issue templates have distinct, usable metadata", () => {
  const bugMetadata = frontmatter(bug);
  const taskMetadata = frontmatter(task);
  for (const metadata of [bugMetadata, taskMetadata]) {
    assert.ok(metadata.name);
    assert.ok(metadata.about);
    assert.ok(metadata.title?.endsWith(": "));
  }
  assert.notEqual(bugMetadata.name, taskMetadata.name);
  assert.notEqual(bugMetadata.title, taskMetadata.title);
});

test("public intake links to the canonical security policy", () => {
  for (const template of [bug, task]) {
    assert.match(
      template,
      /https:\/\/github\.com\/vlovers\/rulewitness\/blob\/main\/SECURITY\.md/,
    );
    assert.match(template, /do not|never/i);
    assert.match(template, /securit(y|ies)|vulnerabilit(y|ies)/i);
  }
});

test("bug intake collects reproducible, sanitized CLI evidence", () => {
  for (const term of [
    /minimal reproduction/i,
    /sanitized/i,
    /Node\.js and Git/i,
    /exit code/i,
    /schemaVersion/,
    /complete/,
    /uncertainty/i,
    /independent review/i,
  ]) {
    assert.match(bug, term);
  }
});

test("task intake separates review, release and runtime claims", () => {
  for (const term of [
    /non-goals/i,
    /independently reviewed/i,
    /published/i,
    /runtime authorization/i,
    /exit(s)? 0\/1\/2\/3/i,
    /installed npm consumer/i,
    /separate authorization/i,
  ]) {
    assert.match(task, term);
  }
});

test("security disclosure links use the current repository", () => {
  assert.match(
    security,
    /https:\/\/github\.com\/vlovers\/rulewitness\/security\/advisories\/new/,
  );
  assert.match(security, /https:\/\/github\.com\/vlovers\/rulewitness\/issues/);
  assert.doesNotMatch(
    security,
    /github\.com\/vlovers\/agent-permission-diff\//,
  );
});

test("security disclosure does not promise GitHub settings", () => {
  assert.match(security, /if the repository currently offers that form/i);
  assert.match(security, /without vulnerability details/i);
  assert.match(security, /no response-time commitment/i);
  assert.match(security, /responsible maintainer/i);
});

test("security preserves unknown and exit behavior", () => {
  for (const term of [
    /complete: false/,
    /exit 3/,
    /never execute/i,
    /read-only/i,
    /fingerprints/i,
    /not.*runtime permission comparisons/i,
    /must never be used to authorize/i,
  ]) {
    assert.match(security, term);
  }
});

test("contributor guidance reflects gated publishing", () => {
  assert.match(contributing, /gated npm release workflow/i);
  assert.match(contributing, /separate maintainer authorization/i);
  assert.match(contributing, /SECURITY\.md/);
  assert.doesNotMatch(
    contributing,
    /This project has no publishing or deployment automation/,
  );
});
