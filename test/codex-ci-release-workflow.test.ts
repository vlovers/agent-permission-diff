import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publish = readFileSync(".github/workflows/npm-publish.yml", "utf8");
const codex = readFileSync(
  "examples/github-actions/codex-posture-pr.yml",
  "utf8",
);

test("postpublish: retries reads only, preserving OIDC and prerelease tags", () => {
  const verification = publish.split(
    "- name: Verify published version and registry dist-tags",
  )[1];
  assert.ok(verification);
  assert.match(verification, /seq 1 24/);
  assert.match(verification, /--prefer-online/);
  assert.match(verification, /--cache="\$RUNNER_TEMP\/npm-verification-cache"/);
  assert.match(verification, /before\.latest !== after\.latest/);
  assert.match(verification, /after\[expectedTag\] !== version/);
  assert.match(verification, /Published package could not be verified/);
  assert.doesNotMatch(verification, /npm publish/);
  assert.match(publish, /release:\s*\n\s*types:\s*\[published\]/);
  assert.match(publish, /id-token: write/);
});

test("Codex CI example: fork-safe trusted package and no checkout head execution", () => {
  assert.match(codex, /pull_request:/);
  assert.doesNotMatch(codex, /pull_request_target:/);
  assert.match(codex, /contents: read/);
  assert.match(codex, /persist-credentials: false/);
  assert.match(codex, /fetch-depth: 0/);
  assert.match(codex, /setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1/);
  assert.match(
    codex,
    /npm install --global --ignore-scripts --no-audit --no-fund rulewitness@0\.4\.0-rc\.2/,
  );
  assert.match(codex, /github\.event\.pull_request\.base\.sha/);
  assert.match(codex, /github\.event\.pull_request\.head\.sha/);
  assert.match(codex, /git cat-file -e/);
  assert.match(codex, /codex-review "\$BASE_SHA" "\$HEAD_SHA" --json/);
  assert.doesNotMatch(codex, /npm (ci|run|publish) /);
  assert.doesNotMatch(codex, /secrets\.|GITHUB_TOKEN|pull-requests: write/);
});

test("Codex CI example: unverified runtime and unknown must never silently pass", () => {
  assert.match(codex, /runtimeVerified !== false/);
  assert.match(codex, /runtimePermissionDiff !== false/);
  assert.match(codex, /comparison\.uncertain/);
  assert.match(codex, /direction === "unknown"/);
  assert.match(codex, /if \(unknown\) process\.exit\(3\)/);
  assert.match(codex, /if \(changed > 0\) process\.exit\(1\)/);
  assert.match(codex, /GITHUB_STEP_SUMMARY/);
});
