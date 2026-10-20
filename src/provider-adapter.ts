/**
 * Internal experimental adapter contract. Not part of the public package exports.
 * This compares provider-defined symbolic candidates, NOT runtime authorization.
 */
export type ModelDecision =
  | { kind: "known"; value: string }
  | { kind: "unknown"; reason: string };

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

function validDecision(value: ModelDecision): boolean {
  return (
    (value.kind === "known" &&
      typeof value.value === "string" &&
      value.value.length > 0) ||
    (value.kind === "unknown" &&
      typeof value.reason === "string" &&
      value.reason.length > 0)
  );
}

function evaluateStable<Snapshot>(
  adapter: ModelAdapter<Snapshot>,
  snapshot: Snapshot,
  candidate: string,
): ModelDecision {
  const first = adapter.evaluate(snapshot, candidate);
  const replay = adapter.evaluate(snapshot, candidate);
  if (
    !validDecision(first) ||
    !validDecision(replay) ||
    JSON.stringify(first) !== JSON.stringify(replay)
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
    const left = evaluateStable(adapter, before, candidate);
    const right = evaluateStable(adapter, after, candidate);
    if (
      left.kind === "unknown" ||
      right.kind === "unknown" ||
      left.value !== right.value
    )
      findings.push({ candidate, before: left, after: right });
  }
  return findings;
}
