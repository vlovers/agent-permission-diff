import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { devNull } from "node:os";
import test from "node:test";
import { comparePolicies, readPolicy } from "../src/index.ts";

test("Git and CLI compare blobs without changing checkout, index, or executing configuration", () => {
  const directory = mkdtempSync(resolve(".apd-test-"));
  const cli = resolve("src/cli.ts");
  const fixtureEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
      env: {
        ...fixtureEnv,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_COUNT: "0",
      },
    }).trim();
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--experimental-strip-types", cli, ...args], {
      cwd: directory,
      encoding: "utf8",
    });
  try {
    git("init", "--quiet");
    mkdirSync(join(directory, ".claude"));
    const settings = join(directory, ".claude/settings.json");
    const commit = (message: string) => {
      git("add", ".");
      git(
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        `core.hooksPath=${devNull}`,
        "commit",
        "--quiet",
        "-m",
        message,
      );
      return git("rev-parse", "HEAD");
    };
    writeFileSync(
      settings,
      JSON.stringify({ permissions: { ask: ["WebSearch"], deny: ["Bash"] } }),
    );
    const before = commit("before");
    writeFileSync(
      settings,
      JSON.stringify({ permissions: { allow: ["WebSearch"], deny: ["Bash"] } }),
    );
    const after = commit("after");
    // A dirty working copy must never enter the revision comparison.
    writeFileSync(settings, "dirty and deliberately invalid");
    const status = git("status", "--porcelain=v1"),
      head = git("rev-parse", "HEAD");
    const index = readFileSync(join(directory, ".git/index"));
    const report = comparePolicies(
      readPolicy(directory, before),
      readPolicy(directory, after),
    );
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0]!.severity, "HIGH");
    const result = run("compare", before, after, "--json");
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), report);
    assert.match(run("compare", before, after).stdout, /ASK → ALLOW/);
    assert.equal(JSON.parse(run("scan", "--json").stdout).command, "scan");
    assert.equal(run("scan", "--bad").status, 2);
    assert.equal(run("compare", before).status, 2);
    assert.equal(run("scan", "missing-ref").status, 2);
    assert.equal(run("--help").status, 0);
    assert.throws(() => readPolicy(directory, "--help"), /Invalid/);
    assert.throws(
      () => readPolicy(join(directory, ".claude"), "HEAD"),
      /repository root/,
    );
    assert.equal(git("status", "--porcelain=v1"), status);
    assert.equal(git("rev-parse", "HEAD"), head);
    assert.deepEqual(readFileSync(join(directory, ".git/index")), index);
    const marker = join(directory, "CONFIG_EXECUTED");
    writeFileSync(
      settings,
      JSON.stringify({
        hooks: { PreToolUse: [{ command: "touch CONFIG_EXECUTED" }] },
        permissions: { allow: ["Bash(touch CONFIG_EXECUTED)"] },
      }),
    );
    const withHook = commit("untrusted config");
    assert.ok(readPolicy(directory, withHook).issues.length);
    assert.equal(run("scan", withHook).status, 0);
    assert.equal(existsSync(marker), false);
    rmSync(settings);
    symlinkSync("../DO_NOT_READ_CREDENTIALS", settings);
    const linked = commit("symlink");
    const linkedPolicy = readPolicy(directory, linked);
    assert.ok(
      linkedPolicy.issues.some((issue) => issue.message.includes("symlinks")),
    );
    assert.equal(linkedPolicy.rules.length, 0);
    rmSync(join(directory, ".claude"), { recursive: true });
    symlinkSync("DO_NOT_FOLLOW", join(directory, ".claude"));
    const parentLink = commit("symlink parent");
    const parentPolicy = readPolicy(directory, parentLink);
    assert.equal(parentPolicy.issues[0]!.evidence.file, ".claude");
    assert.equal(parentPolicy.rules.length, 0);
    assert.ok(
      comparePolicies(linkedPolicy, parentPolicy).findings.some(
        (finding) => finding.kind === "coverage",
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
