import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePolicies,
  evaluate,
  formatHuman,
  parsePolicy,
  scanPolicy,
} from "../src/index.ts";
import { matches, regions } from "../src/glob.ts";

const file = ".claude/settings.json";
const parse = (document: unknown, revision = "audit") =>
  parsePolicy(revision, { [file]: JSON.stringify(document) });

test("audit: unchanged unknown settings cannot hide permission-list changes", () => {
  for (const setting of [
    { hooks: { PreToolUse: [] } },
    { sandbox: { enabled: true } },
    { permissions: { defaultMode: "auto" } },
  ]) {
    const make = (rules: object) =>
      parse({ ...setting, permissions: { ...setting.permissions, ...rules } });
    const before = make({ deny: ["Bash"] });
    const after = make({ allow: ["Bash"] });
    const report = comparePolicies(before, after);
    assert.ok(
      report.findings.some((finding) => finding.kind === "coverage"),
      JSON.stringify(setting),
    );
    assert.ok(
      report.findings.every(
        (finding) =>
          finding.before.decision === "UNKNOWN" &&
          finding.after.decision === "UNKNOWN",
      ),
    );
    assert.ok(
      report.findings.some((finding) =>
        finding.before.evidence.some((e) => e.rule === "Bash"),
      ),
    );
    assert.doesNotMatch(formatHuman(report), /No effective changes/);
    const identical = make({ deny: ["Bash", "Bash"] });
    assert.deepEqual(comparePolicies(before, identical).findings, []);
  }
});

test("audit: unsupported fingerprints preserve JSON types and nested array order", () => {
  const values: unknown[] = [
    null,
    false,
    true,
    0,
    1,
    "1",
    "null",
    "",
    [],
    {},
    { a: 1 },
    [["a", "1"]],
    { a: [] },
    [["a", "[]"]],
    [1, 2],
    [2, 1],
  ];
  const policies = values.map((hooks) => parse({ hooks }));
  assert.equal(
    new Set(policies.map((p) => p.issues[0]!.fingerprint)).size,
    values.length,
  );
  for (let i = 0; i < policies.length; i++)
    for (let j = i + 1; j < policies.length; j++) {
      assert.ok(
        comparePolicies(policies[i]!, policies[j]!).findings.some(
          (f) => f.kind === "coverage",
        ),
        `${i} -> ${j}`,
      );
    }
});

test("audit: numeric unknown property names are not erased as if rule indexes", () => {
  assert.ok(
    comparePolicies(parse({ "0": "value" }), parse({ "1": "value" })).findings
      .length,
  );
});

test("audit: numeric overflow and signed zero do not collide with null or zero fingerprints", () => {
  const policies = ["null", "1e999", "-1e999", "0", "-0"].map((value) =>
    parsePolicy("r", { [file]: `{"hooks":${value}}` }),
  );
  assert.equal(
    new Set(policies.map((p) => p.issues[0]!.fingerprint)).size,
    policies.length,
  );
  for (let i = 1; i < policies.length; i++)
    assert.ok(comparePolicies(policies[0]!, policies[i]!).findings.length);
});

test("audit: parameter wildcard selectors cannot normalize into legacy command prefixes", () => {
  for (const list of ["ask", "deny"] as const)
    for (const selector of [
      "run_in_background:*",
      "timeout:*",
      "description:*",
      "command:*",
      "future_field:*",
      "timeout : *",
    ]) {
      const p = parse({ permissions: { [list]: [`Bash(${selector})`] } });
      assert.ok(p.issues.length, selector);
      assert.equal(evaluate(p, "Bash", "npm test").decision, "UNKNOWN");
    }
  assert.ok(
    comparePolicies(
      parse({ permissions: { deny: ["Bash(run_in_background:*)"] } }),
      parse({ permissions: { deny: ["Bash(run_in_background *)"] } }),
    ).findings.length,
  );
  // Unambiguous documented legacy command prefixes remain supported.
  assert.equal(
    evaluate(
      parse({ permissions: { allow: ["Bash(npm:*)"] } }),
      "Bash",
      "npm test",
    ).decision,
    "ALLOW",
  );
  assert.equal(
    evaluate(
      parse({ permissions: { deny: ["Bash(git push:*)"] } }),
      "Bash",
      "git push",
    ).decision,
    "DENY",
  );
});

test("audit: trailing newline in a rule is malformed rather than silently discarded", () => {
  for (const raw of ["Bash\n", "Bash(npm test)\n", "WebSearch\n"])
    assert.ok(parse({ permissions: { allow: [raw] } }).issues.length);
});

test("audit: runtime-sensitive Bash rule forms stay UNKNOWN and exact grants stay visible", () => {
  for (const command of [
    "watch",
    "setsid",
    "ionice",
    "flock",
    "find",
    "timeout",
    "time",
    "nice",
    "nohup",
    "stdbuf",
    "command",
    "builtin",
    "noglob",
    "xargs",
  ]) {
    const before = parse({ permissions: { allow: [`Bash(${command} *)`] } });
    assert.ok(before.issues.length, command);
    const after = parse({
      permissions: {
        allow: [`Bash(${command} *)`, `Bash(${command} echo hi)`],
      },
    });
    assert.equal(
      evaluate(after, "Bash", `${command} echo hi`).decision,
      "UNKNOWN",
    );
    assert.ok(comparePolicies(before, after).findings.length, command);
  }
});

test("audit: ignored non-permission settings cannot bypass schema-recovery unknowns", () => {
  for (const document of [
    { model: null },
    { model: "new-model" },
    { effortLevel: {} },
    { $schema: [] },
  ]) {
    const p = parse({ ...document, permissions: { allow: ["Bash"] } });
    assert.equal(evaluate(p, "Bash", "npm test").decision, "UNKNOWN");
  }
  assert.ok(
    comparePolicies(parse({ model: null }), parse({ model: "valid-model" }))
      .findings.length,
  );
});

test("audit: official exact and wildcard examples (table)", () => {
  const examples: [string, string[], string[]][] = [
    [
      "npm run build",
      ["npm run build"],
      ["npm run build --watch", "npm run buildx"],
    ],
    [
      "npm run *",
      ["npm run", "npm run build", "npm run test --watch"],
      ["npm install", "npm runx"],
    ],
    [
      "git log * main",
      ["git log -5 main", "git log --oneline main"],
      ["git log main", "git push origin main"],
    ],
    ["git * main", ["git merge main", "git push origin main"], ["git log"]],
    ["* --version", ["node --version"], ["node -v"]],
    ["ls *", ["ls", "ls -la"], ["lsof"]],
    ["ls*", ["ls", "ls -la", "lsof"], ["xls"]],
    ["* --help *", ["npm --help x"], ["npm --help"]],
  ];
  for (const [pattern, yes, no] of examples) {
    const p = parse({ permissions: { allow: [`Bash(${pattern})`] } });
    for (const input of yes)
      assert.equal(
        evaluate(p, "Bash", input).decision,
        "ALLOW",
        `${pattern}: ${input}`,
      );
    for (const input of no)
      assert.equal(
        evaluate(p, "Bash", input).decision,
        "UNKNOWN",
        `${pattern}: ${input}`,
      );
  }
});

test("audit: generated policy pairs cannot miss a concrete modeled decision change", () => {
  const patterns = ["a", "b", "a*", "*b", "a b", "a *", "a*b*", "*"];
  let seed = 0x51a7;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const make = () => {
    const permissions: Record<string, string[]> = {
      deny: [],
      ask: [],
      allow: [],
    };
    for (let i = 0; i < 4; i++)
      permissions[["deny", "ask", "allow"][next() % 3]!]!.push(
        `Bash(${patterns[next() % patterns.length]})`,
      );
    return parse({ permissions });
  };
  const inputs = ["a", "b", "a b", "aa", "ab", "a x", "bb", "x", "axbb"];
  for (let i = 0; i < 100; i++) {
    const before = make(),
      after = make();
    const report = comparePolicies(before, after);
    const transitions = new Set(
      report.findings.map((f) => `${f.before.decision}:${f.after.decision}`),
    );
    for (const input of inputs) {
      const a = evaluate(before, "Bash", input).decision,
        b = evaluate(after, "Bash", input).decision;
      if (a !== b) assert.ok(transitions.has(`${a}:${b}`), input);
    }
    for (const finding of report.findings) {
      assert.equal(
        evaluate(before, finding.tool, finding.witness).decision,
        finding.before.decision,
      );
      assert.equal(
        evaluate(after, finding.tool, finding.witness).decision,
        finding.after.decision,
      );
    }
    assert.deepEqual(comparePolicies(before, before).findings, []);
  }
});

test("audit: product traversal covers all nonempty short-string signatures for generated glob sets", () => {
  const patterns = ["a", "*", "a*", "*b", "a*b", "**", "a**b", "* *", "ab*a"];
  const regex = (p: string) =>
    new RegExp("^" + p.replaceAll("*", ".*") + "$", "s");
  for (let i = 0; i < patterns.length; i++)
    for (let j = i + 1; j < patterns.length; j++) {
      const pair = [patterns[i]!, patterns[j]!];
      const signature = (s: string) =>
        pair.map((p) => regex(p).test(s)).join(",");
      const found = new Set(regions(pair).map(signature));
      let inputs = [""];
      for (let n = 1; n <= 4; n++) {
        inputs = inputs.flatMap((s) => ["a", "b", " ", "z"].map((c) => s + c));
        for (const input of inputs) {
          assert.ok(found.has(signature(input)));
          for (const p of pair)
            assert.equal(matches(p, input), regex(p).test(input));
        }
      }
    }
});

test("audit: JSON v1 structure, determinism, round-trip and terminal escaping", () => {
  const p = parse(
    {
      permissions: { deny: ["Bash"] },
      "evil\u001b[31m\u0085\u202e\u2028": "hidden",
    },
    "r\u001b[31m",
  );
  const report = scanPolicy(p);
  assert.deepEqual(
    Object.keys(report).sort(),
    [
      "schemaVersion",
      "provider",
      "scope",
      "command",
      "revisions",
      "complete",
      "findings",
      "policies",
    ].sort(),
  );
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.complete, false);
  assert.equal(report.scope, "tracked-project-rule-policy");
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
  assert.equal(JSON.stringify(scanPolicy(p)), JSON.stringify(report));
  for (const f of report.findings)
    assert.deepEqual(
      Object.keys(f).sort(),
      [
        "kind",
        "tool",
        "witness",
        "severity",
        "before",
        "after",
        "explanation",
      ].sort(),
    );
  assert.ok(!formatHuman(report).includes("\u001b"));
  for (const unsafe of ["\u0085", "\u202e", "\u2028"])
    assert.ok(!formatHuman(report).includes(unsafe));
});

test("audit: analysis limits fail explicitly instead of yielding a clean comparison", () => {
  assert.throws(() => regions(["a*b*c*"], 20_000, 5), /work units/);
  assert.throws(
    () => parsePolicy("r", { [file]: " ".repeat(2 * 1024 * 1024 + 1) }),
    /2 MiB/,
  );
  let hooks: unknown = 0;
  for (let i = 0; i < 66; i++) hooks = [hooks];
  assert.throws(() => parse({ hooks }), /64 levels/);
});
