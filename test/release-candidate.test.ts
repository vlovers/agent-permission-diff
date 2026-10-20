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
  assert.equal(pkg.name, "rulewitness");
  assert.equal(lock.name, pkg.name);
  assert.equal(root.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(root.version, pkg.version);
  assert.match(String(pkg.version), /^0\.4\.0-rc\.1$/);
});

test("release candidate: publish trigger is not a PR merge", () => {
  const workflow = readFileSync(
    resolve(".github/workflows/npm-publish.yml"),
    "utf8",
  );
  assert.match(workflow, /release:\s*\n\s*types:\s*\[published\]/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /npm publish --access public/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
});
