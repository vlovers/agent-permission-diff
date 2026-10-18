import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const cli = resolve("src/cli.ts");
const cleanEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)),
);

function scenario(before: object | null, after: object | null) {
  const directory = mkdtempSync(join(tmpdir(), "rulewitness-pr-"));
  const env = {
    ...cleanEnvironment,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: devNull,
  };
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
      env,
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  mkdirSync(join(directory, ".claude"));
  const commit = (settings: object | null, message: string) => {
    if (settings !== null)
      writeFileSync(
        join(directory, ".claude/settings.json"),
        JSON.stringify(settings),
      );
    git("add", "--all");
    git(
      "-c",
      "user.name=Tests",
      "-c",
      "user.email=tests@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${devNull}`,
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      message,
    );
    return git("rev-parse", "HEAD");
  };
  const base = commit(before, "base");
  const head = commit(after, "head");
  const run = (args: string[]) =>
    spawnSync(process.execPath, ["--experimental-strip-types", cli, ...args], {
      cwd: directory,
      encoding: "utf8",
      env,
    });
  return { directory, base, head, run };
}

test("PR SHA comparison reports a known high escalation and preserves gating", () => {
  const fixture = scenario(
    { permissions: { ask: ["Bash(npm test)"] } },
    { permissions: { allow: ["Bash(npm test)"] } },
  );
  try {
    const result = fixture.run([
      "compare",
      fixture.base,
      fixture.head,
      "--json",
      "--fail-on",
      "high",
    ]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.revisions, [fixture.base, fixture.head]);
    assert.equal(report.gate.exitCode, 1);
    assert.equal(report.gate.thresholdExceeded, true);
    assert.equal(report.complete, false);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("PR SHA comparison ignores modeled masked additions", () => {
  const fixture = scenario(
    { permissions: { deny: ["Bash(git push *)"] } },
    {
      permissions: {
        deny: ["Bash(git push *)"],
        allow: ["Bash(git push origin main)"],
      },
    },
  );
  try {
    const result = fixture.run([
      "compare",
      fixture.base,
      fixture.head,
      "--json",
      "--fail-on",
      "high",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.findings, []);
    assert.equal(report.complete, false);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("PR SHA comparison fails conservatively with unsupported settings", () => {
  const fixture = scenario(
    { permissions: { allow: ["Bash(npm test)"] } },
    {
      permissions: { allow: ["Bash(npm test)"] },
      hooks: { PreToolUse: [] },
    },
  );
  try {
    const result = fixture.run([
      "compare",
      fixture.base,
      fixture.head,
      "--json",
      "--fail-on",
      "high",
    ]);
    assert.equal(result.status, 3, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.gate.uncertain, true);
    assert.equal(report.gate.exitCode, 3);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("PR missing base object is an analysis error, never a pass", () => {
  const fixture = scenario(
    { permissions: { allow: ["Bash(npm test)"] } },
    { permissions: { allow: ["Bash(npm test)"] } },
  );
  try {
    const missing = "a".repeat(40);
    const result = fixture.run([
      "compare",
      missing,
      fixture.head,
      "--json",
      "--fail-on",
      "high",
    ]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Read-only Git operation failed/);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("PR settings-absent revisions remain partial rather than full security pass", () => {
  const fixture = scenario(null, null);
  try {
    const result = fixture.run([
      "compare",
      fixture.base,
      fixture.head,
      "--json",
      "--fail-on",
      "high",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.complete, false);
    assert.deepEqual(report.findings, []);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
