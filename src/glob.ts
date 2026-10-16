// Glob NFAs: each position is a state; '*' consumes any character or epsilon.
// Explore the product over literal characters plus one OTHER representative.
// This covers every equivalence class of input strings, rather than sampling.
function closure(pattern: string, states: number[]): number[] {
  const result = new Set(states);
  for (const state of result) {
    if (pattern[state] === "*") result.add(state + 1);
  }
  return [...result].sort((a, b) => a - b);
}
function step(pattern: string, states: number[], char: string): number[] {
  const next = new Set<number>();
  for (const state of states) {
    if (pattern[state] === "*") next.add(state);
    else if (pattern[state] === char) next.add(state + 1);
  }
  return closure(pattern, [...next]);
}
export function matches(pattern: string, input: string): boolean {
  let states = closure(pattern, [0]);
  for (const char of input) states = step(pattern, states, char);
  return states.includes(pattern.length);
}
export function regions(patterns: string[], limit = 20_000): string[] {
  if (patterns.length > 128 || patterns.join("").length > 8192) {
    throw new Error(
      "Symbolic analysis input limit exceeded (128 patterns / 8192 characters)",
    );
  }
  const literals = new Set(patterns.join("").replaceAll("*", ""));
  let other = "x";
  while (literals.has(other))
    other = String.fromCodePoint(other.codePointAt(0)! + 1);
  // Prefer a printable OTHER witness over punctuation/whitespace when possible.
  const alphabet = [other, ...[...literals].sort()];
  const initial = patterns.map((pattern) => closure(pattern, [0]));
  const queue = [{ states: initial, witness: "" }];
  const seen = new Set([JSON.stringify(initial) + ":empty"]);
  const signatures = new Set<string>();
  const witnesses: string[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { states, witness } = queue[cursor]!;
    const signature = patterns
      .map((p, i) => (states[i]!.includes(p.length) ? "1" : "0"))
      .join("");
    if (witness.length > 0 && !signatures.has(signature)) {
      signatures.add(signature);
      witnesses.push(witness);
    }
    for (const char of alphabet) {
      const next = patterns.map((p, i) => step(p, states[i]!, char));
      const key = JSON.stringify(next) + ":nonempty";
      if (seen.has(key)) continue;
      if (seen.size >= limit)
        throw new Error(
          `Symbolic analysis exceeds ${limit} states; narrow the policy`,
        );
      seen.add(key);
      queue.push({ states: next, witness: witness + char });
    }
  }
  return witnesses;
}
