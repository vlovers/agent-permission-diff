import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(path, "utf8");
const fixtureData = (name) =>
  read(join(root, "test/fixtures/release", `${name}.json`));
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)),
  ),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: devNull,
  GIT_ALLOW_PROTOCOL: "",
  GIT_AUTHOR_NAME: "Release Example",
  GIT_AUTHOR_EMAIL: "example@example.invalid",
  GIT_COMMITTER_NAME: "Release Example",
  GIT_COMMITTER_EMAIL: "example@example.invalid",
  GIT_AUTHOR_DATE: "2026-10-16T00:00:00Z",
  GIT_COMMITTER_DATE: "2026-10-16T00:00:00Z",
};
const git = (directory, ...args) =>
  execFileSync("git", ["-C", directory, ...args], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const npm = (args, cwd = root) =>
  execFileSync("npm", args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 60_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
let temporary,
  consumer,
  installed,
  manifest,
  dryManifest,
  supported,
  unknown,
  masked,
  mixed,
  empty;

function repository(name, documents) {
  const directory = join(temporary, name);
  mkdirSync(directory);
  git(directory, "init", "-q", "--initial-branch=main", "--object-format=sha1");
  git(directory, "config", "core.autocrlf", "false");
  git(directory, "config", "core.filemode", "false");
  const revisions = [];
  for (const [index, files] of documents.entries()) {
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, file)), { recursive: true });
      writeFileSync(
        join(directory, file),
        typeof content === "string"
          ? content
          : JSON.stringify(content, null, 2) + "\n",
      );
    }
    git(directory, "add", "--all", "--force");
    git(
      directory,
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${devNull}`,
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      index === 0 ? "Before permissions" : "After permissions",
    );
    revisions.push(git(directory, "rev-parse", "HEAD"));
  }
  return { directory, before: revisions[0], after: revisions.at(-1) };
}
function invoke(repo, args, packed = true) {
  const entry = packed ? installed : join(root, "dist/cli.js");
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: repo.directory,
    env,
    encoding: "utf8",
    timeout: 15_000,
  });
}
function successful(repo, args, packed = true) {
  const result = invoke(repo, args, packed);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}
function examples(packed) {
  return {
    "masked-compare.txt": successful(
      masked,
      ["compare", masked.before, masked.after],
      packed,
    ),
    "masked-compare.json": successful(
      masked,
      ["compare", masked.before, masked.after, "--json"],
      packed,
    ),
    "compare.txt": successful(
      supported,
      ["compare", supported.before, supported.after],
      packed,
    ),
    "compare.json": successful(
      supported,
      ["compare", supported.before, supported.after, "--json"],
      packed,
    ),
    "scan.txt": successful(supported, ["scan", supported.after], packed),
    "scan.json": successful(
      supported,
      ["scan", supported.after, "--json"],
      packed,
    ),
    "unknown-compare.txt": successful(
      unknown,
      ["compare", unknown.before, unknown.after],
      packed,
    ),
    "unknown-compare.json": successful(
      unknown,
      ["compare", unknown.before, unknown.after, "--json"],
      packed,
    ),
    "unknown-scan.txt": successful(unknown, ["scan", unknown.after], packed),
    "unknown-scan.json": successful(
      unknown,
      ["scan", unknown.after, "--json"],
      packed,
    ),
  };
}

before(() => {
  assert.ok(existsSync(join(root, "dist/index.js")), "Run npm run build first");
  temporary = mkdtempSync(join(root, ".apd-test-package-"));
  supported = repository("supported", [
    {
      ".claude/settings.json": fixtureData("before"),
      ".claude/settings.local.json": fixtureData("local"),
    },
    { ".claude/settings.json": fixtureData("after") },
  ]);
  const unmodeled = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "touch SHOULD_NOT_RUN" }],
        },
      ],
    },
    sandbox: { enabled: true },
    permissions: {
      deny: ["Read(./.env)", "Bash(git push *)"],
      allow: ["Bash(npm test)"],
    },
  };
  unknown = repository("unknown", [
    { ".claude/settings.json": unmodeled },
    {
      ".claude/settings.json": {
        ...unmodeled,
        permissions: {
          ...unmodeled.permissions,
          allow: [...unmodeled.permissions.allow, "Bash(npm run build)"],
        },
      },
    },
  ]);
  masked = repository("masked", [
    {
      ".claude/settings.json": {
        permissions: { deny: ["Bash(git push *)"], allow: ["Bash(npm test)"] },
      },
    },
    {
      ".claude/settings.json": {
        permissions: {
          deny: ["Bash(git push *)"],
          allow: ["Bash(npm test)", "Bash(git push origin main)"],
        },
      },
    },
  ]);
  empty = repository("empty", [{}, {}]);
  mixed = repository("mixed", [
    {
      ".claude/settings.json": {
        permissions: {
          ask: ["WebSearch"],
          allow: ["Bash(echo 'unsupported')"],
        },
      },
    },
    {
      ".claude/settings.json": {
        permissions: { allow: ["WebSearch", "Bash(echo 'unsupported')"] },
      },
    },
  ]);
  if (
    process.env.RULEWITNESS_UPDATE_EXAMPLES === "1" ||
    process.env.APD_UPDATE_EXAMPLES === "1"
  ) {
    mkdirSync(join(root, "docs/examples"), { recursive: true });
    for (const [name, content] of Object.entries(examples(false)))
      writeFileSync(join(root, "docs/examples", name), content);
  }
  // Both commands inspect/package only this repository; no publish or registry call.
  const options = [
    "--json",
    "--ignore-scripts",
    "--cache",
    join(temporary, "npm-cache"),
  ];
  dryManifest = JSON.parse(npm(["pack", "--dry-run", ...options]))[0];
  manifest = JSON.parse(
    npm(["pack", "--pack-destination", temporary, ...options]),
  )[0];
  consumer = mkdtempSync(join(tmpdir(), "rulewitness-consumer-"));
  assert.ok(
    !consumer.startsWith(root + "/"),
    "Consumer must be outside the source repository",
  );
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "release-consumer", private: true, type: "module" }),
  );
  npm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--cache",
      join(temporary, "npm-cache"),
      join(temporary, manifest.filename),
    ],
    consumer,
  );
  installed = join(consumer, "node_modules/rulewitness/dist/cli.js");
});
after(() => {
  if (consumer) rmSync(consumer, { recursive: true, force: true });
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

test("package: dry-run and actual tarball include only documented runtime and documentation files", () => {
  const modules = [
    "assertions",
    "claude-model-adapter",
    "codex-posture",
    "cli",
    "compare",
    "explain",
    "git",
    "git-reader",
    "glob",
    "index",
    "policy",
    "permission-sources",
    "pr-markdown",
    "provider-adapter",
    "provider-discovery",
    "provider-snapshot",
    "report",
    "session-context",
    "source-aware-evaluation",
    "types",
  ];
  const expected = [
    "package.json",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    ...modules.flatMap((name) => [`dist/${name}.js`, `dist/${name}.d.ts`]),
    ...readdirSync(join(root, "docs"), { recursive: true })
      .filter((name) => /\.(?:md|txt|json)$/.test(name))
      .map((name) => `docs/${name.replaceAll("\\", "/")}`),
  ].sort();
  const paths = (item) => item.files.map((file) => file.path).sort();
  assert.deepEqual(paths(manifest), expected);
  assert.deepEqual(paths(dryManifest), expected);
  assert.ok(
    !paths(manifest).some((path) =>
      /(?:\.idea|node_modules|src\/|test\/|\.git|tsconfig|package-lock)/.test(
        path,
      ),
    ),
  );
  for (const path of [
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
  ])
    assert.equal(
      read(join(consumer, "node_modules/rulewitness", path)),
      read(join(root, path)),
    );
  assert.match(
    read(join(consumer, "node_modules/rulewitness/LICENSE")),
    /MIT License/,
  );
  assert.equal(manifest.entryCount, expected.length);
});

test("package: installed ESM exports, declarations and executable bin work without source files", () => {
  const pkgRoot = join(consumer, "node_modules/rulewitness");
  const pkg = JSON.parse(read(join(pkgRoot, "package.json")));
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.bin["agent-permission-diff"], "dist/cli.js");
  assert.equal(pkg.bin.rulewitness, "dist/cli.js");
  assert.equal(pkg.name, "rulewitness");
  assert.equal(
    pkg.version,
    JSON.parse(read(join(root, "package.json"))).version,
  );
  assert.deepEqual(pkg.exports, {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  });
  assert.equal(pkg.exports["."].import, "./dist/index.js");
  assert.equal(pkg.exports["."].types, "./dist/index.d.ts");
  assert.equal(pkg.exports["./provider-adapter"], undefined);
  assert.equal(pkg.exports["./provider-discovery"], undefined);
  assert.equal(pkg.exports["./provider-snapshot"], undefined);
  assert.equal(pkg.exports["./git-reader"], undefined);
  assert.equal(pkg.exports["./claude-model-adapter"], undefined);
  assert.ok(existsSync(join(pkgRoot, "dist/provider-adapter.js")));
  assert.ok(existsSync(join(pkgRoot, "dist/permission-sources.js")));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.ok(!existsSync(join(pkgRoot, "src")));
  assert.ok(read(installed).startsWith("#!/usr/bin/env node\n"));
  const bin = join(consumer, "node_modules/.bin/agent-permission-diff");
  accessSync(bin, constants.X_OK);
  const help = spawnSync(bin, ["--help"], {
    cwd: consumer,
    env,
    encoding: "utf8",
  });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: rulewitness scan/);
  const primary = spawnSync(
    join(consumer, "node_modules/.bin/rulewitness"),
    ["--help"],
    { cwd: consumer, env, encoding: "utf8" },
  );
  assert.equal(primary.status, 0, primary.stderr);
  assert.equal(primary.stdout, help.stdout);
  assert.doesNotMatch(read(join(pkgRoot, "dist/index.js")), /provider-adapter/);
  writeFileSync(
    join(consumer, "verify.mjs"),
    `import assert from "node:assert/strict"; import * as api from "rulewitness"; for (const name of ["readPolicy","parsePolicy","evaluate","scanPolicy","comparePolicies","formatHuman","severity","formatMarkdown","explainFinding","validateWitness","comparisonOutcome","comparisonExitCode","assessComparisonGate","parseTestConfig","readTestConfig","runPolicyTests","relevantIssues"]) assert.equal(typeof api[name], "function"); const p=api.parsePolicy("r",{}); assert.equal(api.scanPolicy(p).complete,false); assert.equal(typeof api.inventoryPermissionSources,"function"); assert.equal(typeof api.comparePermissionSources,"function"); const source=api.inventoryPermissionSources(p); assert.equal(source.runtimeVerified,false); assert.equal(api.comparePermissionSources(source,source).runtimeEquivalent,false); const t=api.runPolicyTests(p,api.parseTestConfig(JSON.stringify({schemaVersion:1,cases:[{name:"unknown",tool:"Bash",input:"npm test",expected:"UNKNOWN"}]}))); assert.equal(t.passed,false); console.log("installed exports passed");`,
  );
  assert.match(
    execFileSync(process.execPath, ["verify.mjs"], {
      cwd: consumer,
      encoding: "utf8",
      env,
    }),
    /installed exports passed/,
  );
  writeFileSync(
    join(consumer, "verify.ts"),
    `import {parsePolicy, scanPolicy, parseTestConfig, runPolicyTests, formatMarkdown, comparisonOutcome, assessComparisonGate, type ComparisonGate, type Report, type Decision, type PolicyTestReport} from "rulewitness"; const report: Report = scanPolicy(parsePolicy("r", {})); const decision: Decision = report.findings[0]!.after.decision; const assertions: PolicyTestReport=runPolicyTests(parsePolicy("r",{}),parseTestConfig('{"schemaVersion":1,"cases":[{"name":"n","tool":"Bash","input":"npm test","expected":"ALLOW"}]}')); formatMarkdown(assertions); const gate: ComparisonGate=assessComparisonGate({...report,command:"compare"},"high"); void gate.thresholdExceeded; void decision; void comparisonOutcome;`,
  );
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "--target",
      "es2024",
      "verify.ts",
    ],
    { cwd: consumer, encoding: "utf8", env },
  );
});

test("package: compiled compare detects a realistic approval change with correct evidence and JSON", () => {
  const report = JSON.parse(
    successful(supported, [
      "compare",
      supported.before,
      supported.after,
      "--json",
    ]),
  );
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.complete, false);
  assert.equal(report.findings.length, 1);
  const finding = report.findings[0];
  assert.equal(finding.severity, "HIGH");
  assert.equal(finding.witness, "npm run build");
  assert.equal(finding.before.decision, "ASK");
  assert.equal(finding.after.decision, "ALLOW");
  assert.deepEqual(finding.before.evidence[0], {
    revision: supported.before,
    file: ".claude/settings.json",
    pointer: "/permissions/ask/0",
    rule: "Bash(npm run build)",
  });
  assert.equal(finding.after.evidence[0].pointer, "/permissions/allow/1");
  assert.equal(report.policies[1].issues.length, 0);
  assert.ok(
    report.policies[1].rules.some(
      (rule) => rule.evidence.file === ".claude/settings.local.json",
    ),
  );
  assert.match(
    successful(supported, ["compare", supported.before, supported.after]),
    /\[HIGH\].*ASK → ALLOW/,
  );
});

test("package: compiled scan preserves known and UNKNOWN inventory in both formats", () => {
  const report = JSON.parse(successful(supported, ["scan", "--json"]));
  assert.equal(report.command, "scan");
  assert.deepEqual(
    new Set(report.findings.map((f) => f.after.decision)),
    new Set(["ALLOW", "DENY", "ASK", "UNKNOWN"]),
  );
  assert.ok(
    report.findings.some(
      (f) =>
        f.witness === "npm run lint" &&
        f.after.evidence[0].file === ".claude/settings.local.json",
    ),
  );
  assert.match(successful(supported, ["scan"]), /UNKNOWN/);
  const noSettings = JSON.parse(successful(empty, ["scan", "--json"]));
  assert.equal(noSettings.complete, false);
  assert.ok(noSettings.findings.some((f) => f.after.decision === "UNKNOWN"));
});

test("package: unsupported real-world settings stay visible when a rule changes under stable unknowns", () => {
  const report = JSON.parse(
    successful(unknown, ["compare", unknown.before, unknown.after, "--json"]),
  );
  assert.ok(report.findings.some((f) => f.kind === "coverage"));
  assert.ok(
    report.findings.every(
      (f) => f.before.decision === "UNKNOWN" && f.after.decision === "UNKNOWN",
    ),
  );
  assert.ok(
    report.policies[1].issues.some(
      (issue) => issue.evidence.pointer === "/hooks",
    ),
  );
  assert.match(
    successful(unknown, ["compare", unknown.before, unknown.after]),
    /\[MEDIUM\] coverage.*UNKNOWN → UNKNOWN/,
  );
  assert.match(successful(unknown, ["scan"]), /Coverage issue/);
  assert.ok(
    JSON.parse(successful(unknown, ["scan", "--json"])).policies[0].issues
      .length,
  );
  assert.equal(existsSync(join(unknown.directory, "SHOULD_NOT_RUN")), false);
});

test("package: masked changes are suppressed, working copy/index stay untouched, exit codes are documented", () => {
  assert.deepEqual(
    JSON.parse(
      successful(masked, ["compare", masked.before, masked.after, "--json"]),
    ).findings,
    [],
  );
  assert.match(
    successful(masked, ["compare", masked.before, masked.after]),
    /runtime behavior remains unverified/,
  );
  writeFileSync(
    join(supported.directory, ".claude/settings.json"),
    "dirty, not JSON",
  );
  const index = readFileSync(join(supported.directory, ".git/index"));
  const status = git(supported.directory, "status", "--porcelain=v1");
  assert.equal(
    JSON.parse(successful(supported, ["scan", "--json"])).policies[0].issues
      .length,
    0,
  );
  for (const args of [
    ["compare", "HEAD"],
    ["scan", "missing-ref", "--json"],
    ["scan", "--json", "--json"],
  ]) {
    const result = invoke(supported, args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /RuleWitness:/);
  }
  assert.equal(git(supported.directory, "status", "--porcelain=v1"), status);
  assert.deepEqual(
    readFileSync(join(supported.directory, ".git/index")),
    index,
  );
});

test("package: README and checked-in example reports reproduce installed CLI output", () => {
  for (const [name, content] of Object.entries(examples(true))) {
    assert.equal(content, read(join(root, "docs/examples", name)), name);
    assert.equal(
      content,
      read(join(consumer, "node_modules/rulewitness/docs/examples", name)),
      `packed ${name}`,
    );
  }
  const readme = read(join(root, "README.md"));
  const output = read(join(root, "docs/examples/compare.txt")).trim();
  assert.ok(
    readme.includes(output),
    "README must include the actual complete human compare output",
  );
  assert.ok(
    readme.includes(
      read(join(root, "docs/examples/masked-compare.txt")).trim(),
    ),
    "README must include actual masked-change output",
  );
});

test("package: installed policy-test command passes, fails, rejects invalid config, and honors revisions", () => {
  const path = join(supported.directory, "rulewitness.tests.json");
  const cases = {
    schemaVersion: 1,
    cases: [
      {
        name: "Build approval",
        tool: "Bash",
        input: "npm run build",
        expected: "ALLOW",
      },
      {
        name: "Push denied",
        tool: "Bash",
        input: "git push origin main",
        expected: "DENY",
      },
    ],
  };
  writeFileSync(path, JSON.stringify(cases));
  const good = invoke(supported, ["test", "--json"]);
  assert.equal(good.status, 0, good.stderr);
  const report = JSON.parse(good.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.complete, false);
  assert.equal(
    report.results[0].actual.evidence[0].pointer,
    "/permissions/allow/1",
  );
  assert.match(
    successful(supported, ["test"]),
    /Expected: ALLOW; Actual: ALLOW/,
  );
  assert.match(
    successful(supported, ["test", "--markdown"]),
    /^# RuleWitness — Policy Tests/,
  );
  const previous = invoke(supported, [
    "test",
    "--rev",
    supported.before,
    "--config",
    "rulewitness.tests.json",
    "--json",
  ]);
  assert.equal(previous.status, 1);
  assert.equal(JSON.parse(previous.stdout).results[0].actual.decision, "ASK");
  writeFileSync(path, '{"schemaVersion":2,"cases":[]}');
  const bad = invoke(supported, ["test", "--json"]);
  assert.equal(bad.status, 2);
  assert.equal(bad.stdout, "");
  rmSync(path);
});

test("package: installed assertions never pass UNKNOWN or execute compound test inputs", () => {
  const path = join(unknown.directory, "rulewitness.tests.json");
  writeFileSync(
    path,
    JSON.stringify({
      schemaVersion: 1,
      cases: [
        {
          name: "Unknown is not success",
          tool: "Bash",
          input: "npm test",
          expected: "UNKNOWN",
        },
        {
          name: "Do not execute",
          tool: "Bash",
          input: "npm test && touch SHOULD_NOT_RUN",
          expected: "ALLOW",
        },
      ],
    }),
  );
  const result = invoke(unknown, ["test", "--json"]);
  assert.equal(result.status, 1);
  assert.ok(
    JSON.parse(result.stdout).results.every(
      (r) => r.actual.decision === "UNKNOWN" && r.status === "unknown",
    ),
  );
  assert.equal(existsSync(join(unknown.directory, "SHOULD_NOT_RUN")), false);
  rmSync(path);
});

test("package: installed severity gates, Markdown and uncertainty use distinct exit codes", () => {
  const result = invoke(supported, [
    "compare",
    supported.before,
    supported.after,
    "--fail-on",
    "high",
    "--json",
  ]);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).gate, {
    threshold: "high",
    thresholdExceeded: true,
    uncertain: false,
    violations: [0],
    exitCode: 1,
  });
  assert.equal(
    JSON.parse(result.stdout).findings[0].explanation.certainty,
    "modeled",
  );
  assert.equal(
    invoke(masked, [
      "compare",
      masked.before,
      masked.after,
      "--fail-on",
      "high",
    ]).status,
    0,
  );
  const uncertain = invoke(unknown, [
    "compare",
    unknown.before,
    unknown.after,
    "--fail-on",
    "high",
    "--markdown",
  ]);
  assert.equal(uncertain.status, 3);
  assert.match(uncertain.stdout, /^# RuleWitness/);
  assert.match(uncertain.stdout, /UNKNOWN → UNKNOWN/);
  assert.equal(
    invoke(unknown, [
      "compare",
      unknown.after,
      unknown.after,
      "--fail-on",
      "high",
    ]).status,
    3,
  );
  for (const args of [
    ["scan", "--fail-on", "high"],
    ["compare", "HEAD", "HEAD", "--fail-on", "critical"],
    ["test", "--rev"],
    ["compare", "HEAD", "HEAD", "--json", "--markdown"],
  ]) {
    const invalid = invoke(supported, args);
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, "");
  }
});

test("package: installed defaultMode diagnostics and masked rule changes preserve uncertainty exits", () => {
  const documents = [
    { defaultMode: "manual", ask: ["Bash(npm test)", "WebSearch"] },
    { defaultMode: "auto", ask: ["Bash(npm test)", "WebSearch"] },
    { defaultMode: "auto", allow: ["Bash(npm test)", "WebSearch"] },
  ].map((permissions) => ({ ".claude/settings.json": { permissions } }));
  const repo = repository("default-mode-coverage", documents);
  const unresolved = git(repo.directory, "rev-parse", "HEAD~1");
  const scan = JSON.parse(successful(repo, ["scan", unresolved, "--json"]));
  assert.equal(scan.schemaVersion, 1);
  assert.equal(scan.complete, false);
  assert.match(scan.policies[0].issues[0].message, /permissions\.defaultMode/);
  assert.equal(
    scan.policies[0].issues[0].evidence.pointer,
    "/permissions/defaultMode",
  );
  assert.ok(scan.findings.every((f) => f.after.decision === "UNKNOWN"));
  for (const [first, second] of [
    [repo.before, unresolved],
    [unresolved, repo.before],
    [unresolved, repo.after],
    [repo.after, repo.after],
  ]) {
    const args = ["compare", first, second, "--json"];
    assert.equal(invoke(repo, args).status, 0);
    const gated = invoke(repo, [...args, "--fail-on", "info"]);
    assert.equal(gated.status, 3, gated.stderr);
    const report = JSON.parse(gated.stdout);
    assert.deepEqual(report.gate, {
      threshold: "info",
      thresholdExceeded: false,
      uncertain: true,
      violations: [],
      exitCode: 3,
    });
    if (first === unresolved && second === repo.after) {
      assert.equal(report.findings.length, 2);
      assert.ok(
        report.findings.every(
          (f) =>
            f.kind === "coverage" &&
            f.before.decision === "UNKNOWN" &&
            f.after.decision === "UNKNOWN",
        ),
      );
    }
  }
});

test("package: mixed high findings and uncertainty retain both structured gate facts", () => {
  const args = ["compare", mixed.before, mixed.after, "--fail-on", "high"];
  const result = invoke(mixed, [...args, "--json"]);
  assert.equal(result.status, 3);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate.thresholdExceeded, true);
  assert.equal(report.gate.uncertain, true);
  assert.equal(report.gate.exitCode, 3);
  assert.equal(report.gate.violations.length, 1);
  assert.equal(report.findings[report.gate.violations[0]].tool, "WebSearch");
  const human = invoke(mixed, args);
  assert.equal(human.status, 3);
  assert.match(
    human.stdout,
    /thresholdExceeded=true; uncertain=true; exitCode=3/,
  );
});
