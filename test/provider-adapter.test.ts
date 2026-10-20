import assert from "node:assert/strict";
import test from "node:test";
import {
  compareModelSnapshots,
  type ModelAdapter,
  type ModelDecision,
} from "../src/provider-adapter.ts";

type Snapshot = Record<string, ModelDecision>;

const known = (value: string): ModelDecision => ({ kind: "known", value });
const unknown = (reason: string): ModelDecision => ({
  kind: "unknown",
  reason,
});
const adapter: ModelAdapter<Snapshot> = {
  id: "synthetic",
  candidates(before, after) {
    return [...Object.keys(after), ...Object.keys(before)].reverse();
  },
  evaluate(snapshot, candidate) {
    return snapshot[candidate] ?? unknown("not modeled");
  },
};

test("synthetic provider: deterministic ordering, deduplication and semantic changes", () => {
  const before = { z: known("prompt"), a: known("blocked") };
  const after = { a: known("blocked"), z: known("allowed") };
  const findings = compareModelSnapshots(adapter, before, after);
  assert.deepEqual(findings, [
    { candidate: "z", before: known("prompt"), after: known("allowed") },
  ]);
  assert.deepEqual(compareModelSnapshots(adapter, before, after), findings);
});

test("synthetic provider: stable UNKNOWN is not treated as proven no-op", () => {
  assert.deepEqual(
    compareModelSnapshots(
      adapter,
      { sensitive: unknown("ambient policy") },
      { sensitive: unknown("ambient policy") },
    ),
    [
      {
        candidate: "sensitive",
        before: unknown("ambient policy"),
        after: unknown("ambient policy"),
      },
    ],
  );
});

test("synthetic provider: rejects unbounded candidates and invalid identifiers", () => {
  const oversized: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates() {
      return Array.from({ length: 257 }, (_, i) => `candidate-${i}`);
    },
  };
  assert.throws(
    () => compareModelSnapshots(oversized, {}, {}),
    /candidate limit/,
  );
  const duplicateFlood: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates: () => Array(1025).fill("same"),
  };
  assert.throws(
    () => compareModelSnapshots(duplicateFlood, {}, {}),
    /emitted candidate limit/,
  );
  assert.throws(
    () =>
      compareModelSnapshots(
        { ...adapter, id: "../unsafe" },
        { a: known("allowed") },
        {},
      ),
    /provider identifier/,
  );
  assert.throws(
    () =>
      compareModelSnapshots(
        { ...adapter, candidates: () => ["x".repeat(1025)] },
        {},
        {},
      ),
    /Invalid provider candidate/,
  );
});

test("synthetic provider: rejects unstable or invalid evaluator output", () => {
  let calls = 0;
  const unstable: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates: () => ["x"],
    evaluate: () => known(String(++calls)),
  };
  assert.throws(
    () => compareModelSnapshots(unstable, {}, {}),
    /failed replay/,
  );
  const invalid: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates: () => ["x"],
    evaluate: () => known(""),
  };
  assert.throws(
    () => compareModelSnapshots(invalid, {}, {}),
    /failed replay/,
  );
});

test("synthetic provider: unknown transitions remain explicit and ordered", () => {
  const before: Snapshot = {
    alpha: known("read-only"),
    beta: unknown("inherited restriction unavailable"),
    gamma: known("ask"),
    delta: known("same"),
  };
  const after: Snapshot = {
    alpha: unknown("external policy unavailable"),
    beta: known("read-write"),
    gamma: unknown("command rules unsupported"),
    delta: known("same"),
  };
  const findings = compareModelSnapshots(adapter, before, after);
  assert.deepEqual(findings.map((finding) => finding.candidate), [
    "alpha",
    "beta",
    "gamma",
  ]);
  assert.deepEqual(findings[0], {
    candidate: "alpha",
    before: known("read-only"),
    after: unknown("external policy unavailable"),
  });
  assert.deepEqual(findings[1], {
    candidate: "beta",
    before: unknown("inherited restriction unavailable"),
    after: known("read-write"),
  });
  assert.deepEqual(findings[2], {
    candidate: "gamma",
    before: known("ask"),
    after: unknown("command rules unsupported"),
  });
});

test("synthetic provider: a missing candidate cannot be mistaken for an allow", () => {
  const findings = compareModelSnapshots(
    adapter,
    { beforeOnly: known("blocked") },
    { afterOnly: known("granted") },
  );
  assert.deepEqual(findings, [
    {
      candidate: "afterOnly",
      before: unknown("not modeled"),
      after: known("granted"),
    },
    {
      candidate: "beforeOnly",
      before: known("blocked"),
      after: unknown("not modeled"),
    },
  ]);
});

test("synthetic provider: deterministic output with duplicate shuffled candidates", () => {
  const a: Snapshot = { c: known("ask"), b: known("denied"), a: known("ask") };
  const b: Snapshot = { c: known("allowed"), b: known("denied"), a: known("allowed") };
  const shuffle: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates: () => ["c", "a", "c", "b", "a", "b"],
  };
  assert.deepEqual(
    compareModelSnapshots(shuffle, a, b),
    compareModelSnapshots(adapter, a, b),
  );
});

test("synthetic provider: permits bounded repeated and boundary-length candidates", () => {
  const boundary = "c".repeat(1024);
  const dense: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates: () => Array(1024).fill(boundary),
  };
  assert.deepEqual(
    compareModelSnapshots(dense, {}, {}),
    [
      {
        candidate: boundary,
        before: unknown("not modeled"),
        after: unknown("not modeled"),
      },
    ],
  );
});

test("synthetic provider: rejects empty, malformed, and undefined decisions", () => {
  const candidate: ModelAdapter<Snapshot> = {
    ...adapter,
    candidates: () => ["x"],
  };
  for (const decision of [
    { kind: "known", value: "" },
    { kind: "unknown", reason: "" },
    { kind: "not-modeled" },
    undefined,
  ]) {
    const invalid: ModelAdapter<Snapshot> = {
      ...candidate,
      evaluate: () => decision as ModelDecision,
    };
    assert.throws(
      () => compareModelSnapshots(invalid, {}, {}),
      /invalid or failed replay/,
    );
  }
});

test("synthetic provider: rejects empty candidates, and no candidate is a safe finding", () => {
  assert.deepEqual(
    compareModelSnapshots({ ...adapter, candidates: () => [] }, {}, {}),
    [],
  );
  assert.throws(
    () =>
      compareModelSnapshots(
        { ...adapter, candidates: () => [""] },
        {},
        {},
      ),
    /Invalid provider candidate/,
  );
});
