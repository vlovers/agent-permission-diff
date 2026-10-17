import assert from "node:assert/strict";
import test from "node:test";
import { comparePolicies, parsePolicy } from "../src/index.ts";
import type { Decision } from "../src/index.ts";
import { regions } from "../src/glob.ts";

type Lists = Partial<Record<"deny" | "ask" | "allow", string[]>>;
// Independent dynamic-programming oracle: no production matcher, parsed rules,
// evaluator, witness generator or replay helper is used to compute decisions.
// This tests the documented raw rule model, NOT native Claude Code conformance.
function glob(pattern: string, input: string): boolean {
  const table = Array.from({ length: pattern.length + 1 }, () =>
    Array<boolean>(input.length + 1).fill(false),
  );
  table[0]![0] = true;
  for (let p = 1; p <= pattern.length; p++) {
    for (let i = 0; i <= input.length; i++) {
      table[p]![i] =
        pattern[p - 1] === "*"
          ? table[p - 1]![i]! || (i > 0 && table[p]![i - 1]!)
          : i > 0 && pattern[p - 1] === input[i - 1] && table[p - 1]![i - 1]!;
    }
  }
  return table[pattern.length]![input.length]!;
}
function reference(lists: Lists, tool: string, input: string): Decision {
  for (const [key, decision] of [
    ["deny", "DENY"],
    ["ask", "ASK"],
    ["allow", "ALLOW"],
  ] as const) {
    for (const raw of lists[key] ?? []) {
      if (raw === tool) return decision;
      if (!raw.startsWith(tool + "(") || !raw.endsWith(")")) continue;
      let pattern = raw.slice(tool.length + 1, -1);
      if (pattern.endsWith(":*")) pattern = pattern.slice(0, -2) + " *";
      // Documented sole trailing space-star also includes the bare command.
      if (
        pattern.endsWith(" *") &&
        pattern.split("*").length === 2 &&
        input === pattern.slice(0, -2)
      )
        return decision;
      if (glob(pattern, input)) return decision;
    }
  }
  return tool === "WebSearch" ? "ASK" : "UNKNOWN";
}
const policy = (lists: Lists, revision: string) =>
  parsePolicy(revision, {
    ".claude/settings.json": JSON.stringify({ permissions: lists }),
  });
function verify(before: Lists, after: Lists, corpus: string[]) {
  const a = policy(before, "before"),
    b = policy(after, "after");
  assert.deepEqual(a.issues, []);
  assert.deepEqual(b.issues, []);
  const report = comparePolicies(a, b);
  assert.deepEqual(comparePolicies(a, b), report, "deterministic report");
  for (const finding of report.findings) {
    assert.equal(finding.kind, "permission");
    const previous = reference(before, finding.tool, finding.witness);
    const next = reference(after, finding.tool, finding.witness);
    assert.equal(finding.before.decision, previous);
    assert.equal(finding.after.decision, next);
    assert.notEqual(previous, next, "independently verified counterexample");
  }
  for (const tool of ["Bash", "WebSearch"])
    for (const input of corpus) {
      const previous = reference(before, tool, input),
        next = reference(after, tool, input);
      if (previous !== next)
        assert.ok(
          report.findings.some(
            (f) =>
              f.tool === tool &&
              f.before.decision === previous &&
              f.after.decision === next,
          ),
          `missed ${tool}(${JSON.stringify(input)}): ${previous} -> ${next}`,
        );
    }
  return report;
}

test("independent oracle: exact, widening, overlap, precedence, masking and equivalence", () => {
  const corpus = [
    "npm",
    "npm test",
    "npm run build",
    "npmx",
    "git push origin main",
    "x",
    "ab",
    "aab",
    "abb",
  ];
  const cases: [Lists, Lists, boolean][] = [
    [{ ask: ["Bash(npm test)"] }, { allow: ["Bash(npm test)"] }, true],
    [{ allow: ["Bash(npm test)"] }, { allow: ["Bash(npm *)"] }, true],
    [{ ask: ["Bash(npm *)"], allow: ["Bash"] }, { allow: ["Bash"] }, true],
    [
      { deny: ["Bash(npm *)"], allow: ["Bash"] },
      { ask: ["Bash(npm *)"], allow: ["Bash"] },
      true,
    ],
    [
      { deny: ["Bash(git push *)"] },
      { deny: ["Bash(git push *)"], allow: ["Bash(git push origin main)"] },
      false,
    ],
    [
      { ask: ["Bash(npm *)"], allow: ["Bash(npm test)"] },
      { ask: ["Bash(npm *)"] },
      false,
    ],
    [{ allow: ["Bash(a*b)", "Bash(ab)"] }, { allow: ["Bash(a**b)"] }, false],
    [
      { allow: ["Bash(npm *)"] },
      { allow: ["Bash(npm:*)", "Bash(npm test)", "Bash(npm:*)"] },
      false,
    ],
    [
      { allow: ["Bash", "WebSearch"] },
      { allow: ["WebSearch", "Bash(*)"] },
      false,
    ],
    [
      { deny: ["Bash(ab)"], ask: ["Bash(a*)"], allow: ["Bash(*b)"] },
      { deny: ["Bash(ab)"], allow: ["Bash(*b)"] },
      true,
    ],
  ];
  for (const [before, after, changed] of cases)
    assert.equal(verify(before, after, corpus).findings.length > 0, changed);
});

test("independent oracle: 200 seeded policy pairs, exhaustive small-input corpus and emitted witnesses", () => {
  let seed = 0x715517;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const patterns = [
    "a",
    "b",
    "ab",
    "a*",
    "*b",
    "a*b",
    "a**b",
    "*a*",
    "*",
    "a *",
    "a b *",
  ];
  const corpus = ["a", "b", " ", "x"];
  let layer = [...corpus];
  for (let length = 2; length <= 5; length++) {
    layer = layer.flatMap((prefix) =>
      ["a", "b", " ", "x"].map((char) => prefix + char),
    );
    corpus.push(...layer);
  }
  const generate = (): Lists =>
    Object.fromEntries(
      ["deny", "ask", "allow"].map((key) => [
        key,
        Array.from(
          { length: random() % 4 },
          () => `Bash(${patterns[random() % patterns.length]})`,
        ),
      ]),
    );
  for (let i = 0; i < 200; i++) verify(generate(), generate(), corpus);
});

test("symbolic resource limits fail explicitly and deterministically", () => {
  for (const run of [
    () => regions(Array.from({ length: 129 }, (_, i) => `p${i}`)),
    () => regions(["a".repeat(8193)]),
    () => regions(["*a*b*c*d*e*f*", "*b*a*f*e*d*c*"], 3),
    () => regions(["*a*b*c*"], 20_000, 5),
  ]) {
    let message = "";
    for (let repeat = 0; repeat < 2; repeat++)
      assert.throws(run, (error: Error) => {
        assert.match(error.message, /limit|exceeds/);
        if (message) assert.equal(error.message, message);
        message = error.message;
        return true;
      });
  }
});
