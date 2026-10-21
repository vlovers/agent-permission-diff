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
  const pkg = { ...candidate, version: "0.4.0" };
  assert.equal(
    verifyPublishedPackage(pkg, { latest: "0.4.0" }, { ...metadata, ...pkg })
      .tag,
    "latest",
  );
  assert.throws(() =>
    verifyPublishedPackage(pkg, { latest: "0.3.0" }, { ...metadata, ...pkg }),
  );
});

test("postpublish: reject registry lag and changed prerelease tags", () => {
  assert.throws(() => verifyPublishedPackage(candidate, {}, metadata));
  assert.throws(() =>
    verifyPublishedPackage(candidate, { latest: candidate.version, next: candidate.version }, metadata),
  );
  assert.throws(() =>
    verifyPublishedPackage(candidate, { latest: "0.3.0", next: "0.4.0-rc.2" }, metadata),
  );
});

test("postpublish: reject metadata, integrity, and alias mismatch", () => {
  assert.throws(() =>
    verifyPublishedPackage(candidate, tags, { ...metadata, version: "0.3.0" }),
  );
  assert.throws(() =>
    verifyPublishedPackage(candidate, tags, { ...metadata, dist: {} }),
  );
  assert.throws(() =>
    verifyPublishedPackage(candidate, tags, {
      ...metadata,
      bin: { rulewitness: "dist/cli.js" },
    }),
  );
});
