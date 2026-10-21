import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (file: string) =>
  JSON.parse(readFileSync(resolve(file), "utf8")) as Record<string, unknown>;

test("release candidate: package and lockfile agree on name and version", () => {
  const pkg = read("package.json");
  const lock = read("package-lock.json");
  const root = (lock.packages as Record<string, Record<string, unknown>>)[""];
  assert.ok(root, "lockfile root package is required");
  assert.equal(pkg.name, "rulewitness");
  assert.equal(lock.name, pkg.name);
  assert.equal(root.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(root.version, pkg.version);
  assert.match(String(pkg.version), /^0\.4\.0-rc\.2$/);
});

test("release candidate: publish trigger is not a PR merge", () => {
  const workflow = readFileSync(
    resolve(".github/workflows/npm-publish.yml"),
    "utf8",
  );
  assert.match(workflow, /release:\s*\n\s*types:\s*\[published\]/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /\*\-\*\) npm publish --access public --tag next/);
  assert.match(workflow, /\*\) npm publish --access public --tag latest/);
  assert.doesNotMatch(workflow, /^\s*run: npm publish --access public\s*$/m);
  assert.match(workflow, /npm view rulewitness versions --json/);
  assert.match(workflow, /Unexpected npm registry version response/);
  assert.match(workflow, /Package version is already published/);
  assert.match(workflow, /Verify published version and registry dist-tags/);
  assert.match(workflow, /rulewitness-tags-before\.json/);
  assert.match(workflow, /rulewitness-tags-after\.json/);
  assert.match(workflow, /before\.latest !== after\.latest/);
  assert.match(workflow, /Published package could not be verified/);
  assert.match(workflow, /npm view rulewitness versions --json/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
});
