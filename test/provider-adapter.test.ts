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
