import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverProviders,
  requireClaudeProjectFiles,
} from "../src/provider-discovery.ts";

test("inventory: Claude project files are recognized independently of input order", () => {
  const paths = [
    "src/main.ts",
    ".claude/settings.local.json",
    "README.md",
    ".claude/settings.json",
    ".claude/settings.local.json",
  ];
  const found = discoverProviders(paths);
  assert.deepEqual(found, {
    kind: "claude-code",
    files: [".claude/settings.json", ".claude/settings.local.json"],
  });
  assert.deepEqual(discoverProviders([...paths].reverse()), found);
  assert.deepEqual(requireClaudeProjectFiles(found), found.files);
});

test("inventory: Codex is recognized but strictly unsupported", () => {
  const found = discoverProviders([".codex/config.toml"]);
  assert.deepEqual(found, {
    kind: "unsupported",
    provider: "codex",
    files: [".codex/config.toml"],
  });
  assert.throws(
    () => requireClaudeProjectFiles(found),
    /semantic support is unavailable/,
  );
});

test("inventory: mixed project markers reject implicit provider choice", () => {
  const found = discoverProviders([
    ".codex/config.toml",
    ".claude/settings.json",
    ".claude/settings.local.json",
  ]);
  assert.deepEqual(found, {
    kind: "ambiguous",
    providers: ["claude-code", "codex"],
    files: [
      ".claude/settings.json",
      ".claude/settings.local.json",
      ".codex/config.toml",
    ],
  });
  assert.throws(
    () => requireClaudeProjectFiles(found),
    /Ambiguous provider inventory/,
  );
});

test("inventory: absent and nested markers are not effective permissions", () => {
  const found = discoverProviders([
    ".github/workflows/ci.yml",
    "packages/example/.codex/config.toml",
    "packages/example/.claude/settings.json",
    ".claude/settings.json.backup",
  ]);
  assert.deepEqual(found, { kind: "absent", files: [] });
  assert.throws(
    () => requireClaudeProjectFiles(found),
    /No supported project provider/,
  );
});

test("inventory: reject unsafe paths and resource exhaustion", () => {
  for (const path of [
    "",
    "./.claude/settings.json",
    "../.claude/settings.json",
    "/.claude/settings.json",
    "folder//.claude/settings.json",
    "folder/./.claude/settings.json",
    "folder/../.claude/settings.json",
    "folder\\.claude\\settings.json",
    "bad\u0000path",
    "bad\npath",
    "x".repeat(1025),
  ]) {
    assert.throws(
      () => discoverProviders([path]),
      /Invalid provider inventory/,
    );
  }
  assert.throws(
    () => discoverProviders(Array(4097).fill("same-path")),
    /inventory limit exceeded/,
  );
});

test("inventory: no config parsing, CLI invocation or runtime claims", () => {
  const untrusted = [
    ".claude/settings.json",
    "Bash(touch SHOULD_NOT_RUN)",
    "${process.env.HOME}/.codex/config.toml",
  ];
  const result = discoverProviders(untrusted);
  assert.deepEqual(result, {
    kind: "claude-code",
    files: [".claude/settings.json"],
  });
  assert.equal("complete" in result, false);
  assert.equal("decision" in result, false);
});
