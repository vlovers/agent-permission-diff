import assert from "node:assert/strict";
import test from "node:test";
import { comparePolicies, evaluate, parsePolicy } from "../src/index.ts";
import {
  claudeModelAdapter,
  encodeClaudeCandidate,
} from "../src/claude-model-adapter.ts";
import { compareModelSnapshots } from "../src/provider-adapter.ts";

type Settings = Record<string, unknown>;
const snapshot = (revision: string, content: Settings) =>
  parsePolicy(revision, {
    ".claude/settings.json": JSON.stringify(content),
  });

test("Claude bridge matches existing evaluator on exact, wildcard and WebSearch", () => {
  const policy = snapshot("baseline", {
    permissions: {
      deny: ["Bash(git push *)"],
      ask: ["Bash(npm run build)"],
      allow: ["Bash(npm *)", "WebSearch"],
    },
  });
  for (const [tool, input] of [
    ["Bash", "git push origin main"],
    ["Bash", "npm test"],
    ["Bash", "npm run build"],
    ["Bash", "outside"],
    ["WebSearch", "*"],
  ] as const) {
    const actual = evaluate(policy, tool, input);
    const bridge = claudeModelAdapter.evaluate(
      policy,
      encodeClaudeCandidate(tool, input),
    );
    assert.deepEqual(
      bridge,
      actual.decision === "UNKNOWN"
        ? { kind: "unknown", reason: actual.reason }
        : { kind: "known", value: actual.decision },
    );
  }
});

test("Claude bridge preserves known findings from legacy comparison", () => {
  const cases: [Settings, Settings][] = [
    [
      { permissions: { ask: ["Bash(npm test)"] } },
      { permissions: { allow: ["Bash(npm test)"] } },
    ],
    [
      { permissions: { deny: ["Bash(git push *)"] } },
      {
        permissions: {
          deny: ["Bash(git push *)"],
          allow: ["Bash(git push origin main)"],
        },
      },
    ],
    [
      { permissions: { ask: ["WebSearch"] } },
      { permissions: { allow: ["WebSearch"] } },
    ],
    [
      { permissions: { allow: ["Bash(npm test)"] } },
      { permissions: { allow: ["Bash(npm *)"] } },
    ],
  ];
  for (const [first, second] of cases) {
    const before = snapshot("base", first);
    const after = snapshot("head", second);
    const legacy = comparePolicies(before, after);
    const bridge = compareModelSnapshots(claudeModelAdapter, before, after);
    for (const finding of legacy.findings.filter(
      (item) =>
        item.kind === "permission" &&
        item.before.decision !== "UNKNOWN" &&
        item.after.decision !== "UNKNOWN",
    )) {
      const candidate = encodeClaudeCandidate(
        finding.tool as "Bash" | "WebSearch",
        finding.witness,
      );
      assert.ok(
        bridge.some(
          (item) =>
            item.candidate === candidate &&
            item.before.kind === "known" &&
            item.before.value === finding.before.decision &&
            item.after.kind === "known" &&
            item.after.value === finding.after.decision,
        ),
        `Lost known transition for ${candidate}`,
      );
    }
    assert.equal(legacy.schemaVersion, 1);
    assert.equal(legacy.provider, "claude-code");
    assert.equal(legacy.complete, false);
    assert.deepEqual(
      comparePolicies(before, after),
      legacy,
      "Existing JSON v1 must remain deterministic",
    );
  }
});

test("Claude bridge keeps unsupported hooks and stable UNKNOWN visible", () => {
  const hooks = { PreToolUse: [{ command: "echo ignored" }] };
  const before = snapshot("base", {
    hooks,
    permissions: { ask: ["Bash(npm test)"] },
  });
  const after = snapshot("head", {
    hooks,
    permissions: { allow: ["Bash(npm test)"] },
  });
  const bridge = compareModelSnapshots(claudeModelAdapter, before, after);
  assert.ok(
    bridge.some(
      (item) => item.before.kind === "unknown" && item.after.kind === "unknown",
    ),
  );
  assert.ok(
    comparePolicies(before, after).findings.some(
      (item) => item.kind === "coverage",
    ),
  );
});

test("Claude bridge rejects forged candidates and stays read-only", () => {
  const policy = snapshot("r", { permissions: { allow: ["WebSearch"] } });
  const serialized = JSON.stringify(policy);
  for (const candidate of [
    "not-json",
    '["Other","x"]',
    '["Bash"]',
    '["Bash",5]',
    '["Bash","x",null]',
    '["Bash","x"] ',
  ]) {
    assert.throws(
      () => claudeModelAdapter.evaluate(policy, candidate),
      /Invalid Claude model candidate/,
    );
  }
  assert.equal(JSON.stringify(policy), serialized);
  assert.deepEqual(
    claudeModelAdapter.candidates(policy, policy),
    claudeModelAdapter.candidates(policy, policy),
  );
});
