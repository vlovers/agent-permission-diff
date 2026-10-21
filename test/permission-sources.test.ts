import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePermissionSources,
  comparePolicies,
  inventoryPermissionSources,
  parsePolicy,
} from "../src/index.ts";
import type { PermissionSource, PermissionSourceKind } from "../src/index.ts";

const shared = ".claude/settings.json";
const local = ".claude/settings.local.json";
const p = (files: Record<string, string>, revision = "rev") =>
  parsePolicy(revision, files);
const settings = JSON.stringify({
  permissions: { allow: ["Bash(npm test)"], deny: ["Bash(rm *)"] },
});

test("sources: inventory only identifies files actually inspected in the revision", () => {
  const policy = p({ [shared]: settings, [local]: settings }, "deadbeef");
  const inventory = inventoryPermissionSources(policy);
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.revision, "deadbeef");
  assert.deepEqual(inventory.trackedFiles, [shared, local]);
  assert.deepEqual(
    inventory.sources.map((source) => [source.kind, source.availability]),
    [
      ["managed", "unknown"],
      ["user", "unknown"],
      ["project", "inspected"],
      ["project-local", "inspected"],
      ["session", "unknown"],
      ["hooks", "unknown"],
    ],
  );
  assert.equal(inventory.runtimeVerified, false);
});

test("sources: absence in Git does not prove absence in the live session", () => {
  const inventory = inventoryPermissionSources(p({}));
  assert.deepEqual(inventory.trackedFiles, []);
  assert.equal(
    inventory.sources.find((item) => item.kind === "project")?.availability,
    "unknown",
  );
  assert.equal(
    inventory.sources.find((item) => item.kind === "project-local")?.availability,
    "unknown",
  );
  assert.equal(inventory.runtimeVerified, false);
});

test("sources: external caller facts remain explicit, bounded and deterministic", () => {
  const facts: PermissionSource[] = [
    { kind: "session", availability: "present-uninspected" },
    { kind: "managed", availability: "absent-asserted" },
    { kind: "hooks", availability: "unknown" },
  ];
  const a = inventoryPermissionSources(p({ [shared]: settings }), facts);
  const b = inventoryPermissionSources(p({ [shared]: settings }), [...facts].reverse());
  assert.deepEqual(a, b);
  assert.equal(
    a.sources.find((item) => item.kind === "managed")?.availability,
    "absent-asserted",
  );
  assert.equal(
    a.sources.find((item) => item.kind === "session")?.availability,
    "present-uninspected",
  );
});

test("sources: Git marker may not be overridden or marked absent", () => {
  const policy = p({ [shared]: settings });
  for (const availability of [
    "unknown",
    "absent-asserted",
    "present-uninspected",
    "inspected",
  ] as const) {
    assert.throws(
      () =>
        inventoryPermissionSources(policy, [
          { kind: "project", availability },
        ]),
      /Tracked source facts cannot be overridden/,
    );
  }
});

test("sources: reject malformed, duplicate, and unbounded facts without leaking values", () => {
  const policy = p({});
  const invalid = [
    null,
    "managed",
    { kind: "unknown-kind", availability: "unknown" },
    { kind: "managed", availability: "trust-me" },
    { kind: "managed", availability: "inspected" },
  ];
  for (const value of invalid) {
    assert.throws(
      () =>
        inventoryPermissionSources(policy, [value as PermissionSource]),
      /Invalid|External source/,
    );
  }
  assert.throws(
    () =>
      inventoryPermissionSources(policy, [
        { kind: "managed", availability: "unknown" },
        { kind: "managed", availability: "unknown" },
      ]),
    /duplicate/,
  );
  assert.throws(
    () =>
      inventoryPermissionSources(
        policy,
        Array(20).fill({ kind: "user", availability: "unknown" }),
      ),
    /Invalid/,
  );
});

test("sources: compare only changes in provenance, not effective permissions", () => {
  const beforePolicy = p({ [shared]: settings }, "before");
  const afterPolicy = p({ [shared]: settings, [local]: settings }, "after");
  const before = inventoryPermissionSources(beforePolicy, [
    { kind: "managed", availability: "unknown" },
  ]);
  const after = inventoryPermissionSources(afterPolicy, [
    { kind: "managed", availability: "present-uninspected" },
  ]);
  const result = comparePermissionSources(before, after);
  assert.deepEqual(result.changes, [
    { kind: "managed", before: "unknown", after: "present-uninspected" },
    { kind: "project-local", before: "unknown", after: "inspected" },
  ]);
  assert.equal(result.runtimeEquivalent, false);
  assert.equal(comparePolicies(beforePolicy, afterPolicy).schemaVersion, 1);
});

test("sources: equal inventories are not proof of equal runtime authorization", () => {
  const inventory = inventoryPermissionSources(p({ [shared]: settings }));
  const result = comparePermissionSources(inventory, inventory);
  assert.deepEqual(result.changes, []);
  assert.equal(result.runtimeEquivalent, false);
});

test("sources: incompatible inventory input is rejected even from JavaScript", () => {
  const inventory = inventoryPermissionSources(p({}));
  assert.throws(
    () =>
      comparePermissionSources(
        { ...inventory, schemaVersion: 2 } as unknown as typeof inventory,
        inventory,
      ),
    /Invalid permission source inventory/,
  );
});
