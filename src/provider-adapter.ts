/**
 * Internal experimental adapter contract. Not part of the public package exports.
 * This compares provider-defined symbolic candidates, NOT runtime authorization.
 * Consumers must not use this internal function as an effective-permission gate.
 */
export type ModelDecision =
  { kind: "known"; value: string } | { kind: "unknown"; reason: string };

export interface ModelAdapter<Snapshot> {
  readonly id: string;
  candidates(before: Snapshot, after: Snapshot): Iterable<string>;
  evaluate(snapshot: Snapshot, candidate: string): ModelDecision;
}

export interface ModelFinding {
  candidate: string;
  before: ModelDecision;
  after: ModelDecision;
}

const MAX_CANDIDATES = 256;
const MAX_EMITTED_CANDIDATES = 1024;
const MAX_CANDIDATE_LENGTH = 1024;
const MAX_DECISION_LENGTH = 1024;

function normalizeDecision(value: unknown): ModelDecision {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Provider evaluation is invalid or failed replay");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    record.kind === "known" &&
    keys.length === 2 &&
    keys[0] === "kind" &&
    keys[1] === "value" &&
    typeof record.value === "string" &&
    record.value.length > 0 &&
    record.value.length <= MAX_DECISION_LENGTH
  )
    return { kind: "known", value: record.value };
  if (
    record.kind === "unknown" &&
    keys.length === 2 &&
    keys[0] === "kind" &&
    keys[1] === "reason" &&
    typeof record.reason === "string" &&
    record.reason.length > 0 &&
    record.reason.length <= MAX_DECISION_LENGTH
  )
    return { kind: "unknown", reason: record.reason };
  throw new Error("Provider evaluation is invalid or failed replay");
}

function evaluateStable<Snapshot>(
  adapter: ModelAdapter<Snapshot>,
  snapshot: Snapshot,
  candidate: string,
): ModelDecision {
  const first = normalizeDecision(adapter.evaluate(snapshot, candidate));
  const replay = normalizeDecision(adapter.evaluate(snapshot, candidate));
  if (first.kind !== replay.kind)
    throw new Error("Provider evaluation is invalid or failed replay");
  if (
    (first.kind === "known" &&
      replay.kind === "known" &&
      first.value !== replay.value) ||
    (first.kind === "unknown" &&
      replay.kind === "unknown" &&
      first.reason !== replay.reason)
  )
    throw new Error("Provider evaluation is invalid or failed replay");
  return first;
}

/**
 * Unknown-to-unknown is retained, never classified as proven equivalence.
 * There is deliberately no mapping to Claude decisions, severity, or JSON v1.
 */
export function compareModelSnapshots<Snapshot>(
  adapter: ModelAdapter<Snapshot>,
  before: Snapshot,
  after: Snapshot,
): ModelFinding[] {
  if (!/^[a-z][a-z0-9-]*$/.test(adapter.id))
    throw new Error("Invalid provider identifier");
  const candidates = new Set<string>();
  let emitted = 0;
  for (const candidate of adapter.candidates(before, after)) {
    if (++emitted > MAX_EMITTED_CANDIDATES)
      throw new Error("Provider emitted candidate limit exceeded");
    if (
      typeof candidate !== "string" ||
      candidate.length === 0 ||
      candidate.length > MAX_CANDIDATE_LENGTH
    )
      throw new Error("Invalid provider candidate");
    candidates.add(candidate);
    if (candidates.size > MAX_CANDIDATES)
      throw new Error("Provider candidate limit exceeded");
  }
  const findings: ModelFinding[] = [];
  for (const candidate of [...candidates].sort()) {
    // Recheck both snapshots after the cross-snapshot evaluation. A stateful
    // adapter may be stable on adjacent calls but change after evaluating
    // the other snapshot; such findings must never be trusted.
    const left = evaluateStable(adapter, before, candidate);
    const right = evaluateStable(adapter, after, candidate);
    const leftReplay = evaluateStable(adapter, before, candidate);
    const rightReplay = evaluateStable(adapter, after, candidate);
    if (
      JSON.stringify(left) !== JSON.stringify(leftReplay) ||
      JSON.stringify(right) !== JSON.stringify(rightReplay)
    )
      throw new Error("Provider evaluation is invalid or failed replay");
    if (
      left.kind === "unknown" ||
      right.kind === "unknown" ||
      left.value !== right.value
    )
      findings.push({ candidate, before: left, after: right });
  }
  return findings;
}
