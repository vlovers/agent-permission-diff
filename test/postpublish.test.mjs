import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublishedPackage } from "../scripts/verify-published-package.mjs";

const candidate = {
  name: "rulewitness",
  version: "0.4.0-rc.1",
};
const metadata = {
  ...candidate,
  dist: { integrity: "sha512-example" },
  bin: {
    rulewitness: "dist/cli.js",
    "agent-permission-diff": "dist/cli.js",
  },
};
const tags = { latest: "0.3.0", next: "0.4.0-rc.1" };

test("postpublish: prerelease keeps stable latest and targets next", () => {
  assert.deepEqual(verifyPublishedPackage(candidate, tags, metadata), {
    version: candidate.version,
    tag: "next",
    latest: "0.3.0",
  });
});

test("postpublish: stable versions must target latest", () => {
  const stable = { ...candidate, version: "0.4.0" };
  const stableMetadata = { ...metadata, ...stable };
  const staleTags = { latest: "0.3.0" };
  assert.equal(
    verifyPublishedPackage(stable, { latest: "0.4.0" }, stableMetadata).tag,
    "latest",
  );
  assert.throws(() => verifyPublishedPackage(stable, staleTags, stableMetadata));
});

test("postpublish: reject registry lag and changed prerelease tags", () => {
  const latestChanged = { ...tags, latest: candidate.version };
  const nextChanged = { ...tags, next: "0.4.0-rc.2" };
  assert.throws(() => verifyPublishedPackage(candidate, {}, metadata));
  assert.throws(() => verifyPublishedPackage(candidate, latestChanged, metadata));
  assert.throws(() => verifyPublishedPackage(candidate, nextChanged, metadata));
});

test("postpublish: reject metadata, integrity, and alias mismatch", () => {
  const wrongVersion = { ...metadata, version: "0.3.0" };
  const noIntegrity = { ...metadata, dist: {} };
  const missingAlias = { ...metadata, bin: { rulewitness: "dist/cli.js" } };
  assert.throws(() => verifyPublishedPackage(candidate, tags, wrongVersion));
  assert.throws(() => verifyPublishedPackage(candidate, tags, noIntegrity));
  assert.throws(() => verifyPublishedPackage(candidate, tags, missingAlias));
});
