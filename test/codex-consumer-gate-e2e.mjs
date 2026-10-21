// Execute the exact inline consumer-workflow gate against an installed npm CLI.
// This is a local Actions-step emulation, not a cross-repository Actions run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = readFileSync("examples/github-actions/codex-posture-pr.yml", "utf8");
const gate = workflow.split("      - name: Compare exact Git commits (configured posture only)\n")[1];
assert.ok(gate, "consumer comparison step must exist");
const block = gate.split("\n      - name: ")[0];
const marker = "        run: |\n";
assert.ok(block.includes(marker), "comparison step must use a literal shell block");
const script = block.split(marker)[1].split("\n").filter((line) => line.startsWith("          ") || line === "").map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n");
assert.match(script, /rulewitness codex-review/);
assert.match(script, /GITHUB_STEP_SUMMARY/);
const root = mkdtempSync(join(tmpdir(), "rulewitness-consumer-gate-"));
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
function git(args) {
  const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function commit(name, toml) {
  mkdirSync(join(root, ".codex"), { recursive: true });
  writeFileSync(join(root, ".codex/config.toml"), toml);
  git(["add", "--", ".codex/config.toml"]);
  git(["-c", "user.name=RuleWitness", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", name]);
  return git(["rev-parse", "HEAD"]);
}
function caseRun(label, base, head, expectedExit, expectedDirection) {
  const summary = join(root, label + ".md");
  const temp = join(root, label);
  mkdirSync(temp);
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd: root, encoding: "utf8", timeout: 30000,
    env: { ...env, BASE_SHA: base, HEAD_SHA: head, RUNNER_TEMP: temp, GITHUB_STEP_SUMMARY: summary },
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, expectedExit, label + ": " + result.stderr);
  const text = readFileSync(summary, "utf8");
  assert.ok(text.includes("Direction: " + expectedDirection), label + " direction");
  assert.match(text, /Runtime permission verification: \*\*not performed\*\*/);
  assert.match(text, /Configuration precedence, trust and ambient settings: \*\*not established\*\*/);
}
try {
  git(["init", "--quiet"]);
  const base = commit("baseline", 'approval_policy = "on-request"\nsandbox_mode = "read-only"\n');
  const change = commit("broaden", 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n');
  const unsupported = commit("unknown", 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n[profiles.test]\nmodel = "test"\n');
  caseRun("no-change", base, base, 0, "unchanged");
  caseRun("known-change", base, change, 1, "mixed");
  caseRun("unknown-input", change, unsupported, 3, "unknown");
  process.stdout.write("Consumer shell gate E2E: unchanged / configured change / unknown PASS\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}
