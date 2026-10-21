import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const text = readFileSync(".github/workflows/rulewitness-pr.yml", "utf8");

test("PR integration: read-only fork-compatible checkout and pinned action revisions", () => {
  assert.match(text, /pull_request:/);
  assert.doesNotMatch(text, /pull_request_target:/);
  assert.match(text, /contents: read/);
  assert.doesNotMatch(text, /pull-requests: write/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /fetch-depth: 0/);
  assert.match(text, /checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(text, /setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1/);
  assert.match(text, /node-version: 24/);
  assert.doesNotMatch(text, /npm (ci|install)\s*\n/);
  assert.doesNotMatch(text, /npm run (build|test)/);
});

test("PR integration: only stable published analyzer and exact commit objects", () => {
  assert.match(text, /npm install --global --ignore-scripts --no-audit --no-fund rulewitness@0\.3\.0/);
  assert.match(text, /github\.event\.pull_request\.base\.sha/);
  assert.match(text, /github\.event\.pull_request\.head\.sha/);
  assert.match(text, /git cat-file -e/);
  assert.match(text, /rulewitness compare "\$BASE_SHA" "\$HEAD_SHA" --pr-markdown --fail-on high/);
  assert.doesNotMatch(text, /git (checkout|fetch|reset|clean)/);
  assert.doesNotMatch(text, /npx (?!\-\-no-install)/);
});

test("PR integration: report emitted on known finding, unknown or analysis failure", () => {
  assert.match(text, /if: always\(\)/);
  assert.match(text, /set \+e/);
  assert.match(text, /code=\$\?/);
  assert.match(text, /exit "\$code"/);
  for (const code of ["0", "1", "3"]) assert.match(text, new RegExp("^\\s*" + code + "\\)", "m"));
  assert.match(text, /review_outcome=uncertain/);
  assert.match(text, /manual review required/);
  assert.match(text, /GITHUB_STEP_SUMMARY/);
  assert.match(text, /GITHUB_OUTPUT/);
  assert.match(text, /\[ -s "\$RUNNER_TEMP\/rulewitness-report\.md" \]/);
});

test("PR integration: never use untrusted PR metadata as executable shell text", () => {
  assert.doesNotMatch(text, /github\.event\.pull_request\.title/);
  assert.doesNotMatch(text, /github\.event\.pull_request\.body/);
  assert.doesNotMatch(text, /github\.head_ref/);
  assert.doesNotMatch(text, /curl.*\|\s*(bash|sh)/);
  assert.doesNotMatch(text, /GITHUB_TOKEN|secrets\./);
});
