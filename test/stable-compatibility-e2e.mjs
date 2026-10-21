import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const stable = resolve(process.env.RULEWITNESS_STABLE_ROOT || "", "node_modules/rulewitness");
assert.ok(process.env.RULEWITNESS_STABLE_ROOT, "Missing stable installation prefix");
const current = resolve("dist");
const oldApi = await import(pathToFileURL(join(stable, "dist/index.js")).href);
const newApi = await import(pathToFileURL(join(current, "index.js")).href);
for (const name of Object.keys(oldApi)) {
  assert.ok(Object.hasOwn(newApi, name), "Removed stable export: " + name);
  assert.equal(typeof newApi[name], typeof oldApi[name], name);
}
const root = mkdtempSync(join(tmpdir(), "rulewitness-v03-v04-"));
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
function run(command, args) {
  const r = spawnSync(command, args, { cwd: root, env, encoding: "utf8", timeout: 30000 });
  assert.equal(r.error, undefined, String(r.error));
  return r;
}
function git(args) {
  const r = run("git", args);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function commit(name, permissions) {
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(join(root, ".claude/settings.json"), JSON.stringify({ permissions }));
  git(["add", "--", ".claude/settings.json"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", name]);
  return git(["rev-parse", "HEAD"]);
}
function cli(base, args) {
  return run(process.execPath, [join(base, "dist/cli.js"), ...args]);
}
try {
  git(["init", "-q"]);
  const before = commit("ask", { ask: ["Bash(npm run build)"] });
  const after = commit("allow", { allow: ["Bash(npm run build)"] });
  for (const args of [["compare", before, after, "--json"], ["scan", after, "--json"]]) {
    const a = cli(stable, args), b = cli(resolve("."), args);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    const old = JSON.parse(a.stdout), next = JSON.parse(b.stdout);
    assert.equal(old.schemaVersion, 1);
    assert.equal(next.schemaVersion, 1);
    assert.equal(next.complete, false);
    assert.equal(next.command, old.command);
    if (args[0] === "compare") {
      const witness = (r) => r.findings.some((f) => f.witness === "npm run build" && f.before.decision === "ASK" && f.after.decision === "ALLOW");
      assert.ok(witness(old), "Missing old witness");
      assert.ok(witness(next), "Missing candidate witness");
    }
  }
  for (const version of [stable, resolve(".")]) {
    const r = cli(version, ["compare", before, after, "--json", "--fail-on", "high"]);
    assert.equal(r.status, 1, r.stderr);
  }
  process.stdout.write("Published stable API and CLI compatibility: PASS\n");
} finally {
  rmSync(root, { recursive: true, force: true });
}
