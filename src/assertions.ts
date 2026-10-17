import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { evaluate } from "./policy.ts";
import type {
  Decision,
  Policy,
  PolicyTestCase,
  PolicyTestConfig,
  PolicyTestReport,
} from "./types.ts";

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("Unknown policy-test configuration key");
}
export function parseTestConfig(text: string): PolicyTestConfig {
  if (Buffer.byteLength(text, "utf8") > 1024 * 1024)
    throw new Error("Policy tests exceed 1 MiB");
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("Policy tests must be valid JSON");
  }
  if (!object(document)) throw new Error("Policy tests must be an object");
  keys(document, ["schemaVersion", "cases"]);
  if (
    document.schemaVersion !== 1 ||
    !Array.isArray(document.cases) ||
    document.cases.length === 0 ||
    document.cases.length > 1000
  )
    throw new Error("Policy tests require schemaVersion 1 and 1–1000 cases");
  const names = new Set<string>();
  const cases = document.cases.map((value, index): PolicyTestCase => {
    if (!object(value))
      throw new Error(`Policy test ${index} must be an object`);
    keys(value, ["name", "tool", "input", "expected"]);
    if (
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 200 ||
      names.has(value.name)
    )
      throw new Error(
        `Policy test ${index} requires a unique name of 1–200 characters`,
      );
    if (
      typeof value.tool !== "string" ||
      value.tool.length > 100 ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(value.tool)
    )
      throw new Error(`Policy test ${index} has an invalid tool name`);
    if (
      typeof value.input !== "string" ||
      !value.input.length ||
      value.input.length > 4000
    )
      throw new Error(`Policy test ${index} requires 1–4000 input characters`);
    if (
      typeof value.expected !== "string" ||
      !["ALLOW", "ASK", "DENY", "UNKNOWN"].includes(value.expected)
    )
      throw new Error(`Policy test ${index} has an invalid expected decision`);
    names.add(value.name);
    return {
      name: value.name,
      tool: value.tool,
      input: value.input,
      expected: value.expected as Decision,
    };
  });
  return { schemaVersion: 1, cases };
}

/** Reads only regular test-data files resolving within the selected repository. */
export function readTestConfig(
  repository: string,
  path = "rulewitness.tests.json",
): PolicyTestConfig {
  const root = realpathSync(repository);
  const requested = resolve(root, path);
  const real = realpathSync(requested);
  const child = relative(root, real);
  if (
    !child ||
    child === ".." ||
    child.startsWith(`..${sep}`) ||
    isAbsolute(child)
  )
    throw new Error(
      "Policy test configuration must stay inside the repository",
    );
  const info = lstatSync(requested);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 1024 * 1024)
    throw new Error(
      "Policy test configuration must be a regular file of at most 1 MiB",
    );
  const fd = openSync(
    real,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.size > 1024 * 1024 ||
      opened.dev !== info.dev ||
      opened.ino !== info.ino
    )
      throw new Error(
        "Policy test configuration changed or is not a bounded regular file",
      );
    const bytes = Buffer.alloc(1024 * 1024 + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, length);
      if (count === 0) break;
      length += count;
    }
    if (length > 1024 * 1024) throw new Error("Policy tests exceed 1 MiB");
    return parseTestConfig(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        bytes.subarray(0, length),
      ),
    );
  } finally {
    closeSync(fd);
  }
}

function unsupportedQuery(tool: string, input: string): boolean {
  // A narrower assertion boundary than raw glob evaluation: do not turn an
  // unparsed shell expression into a passing test via a broad allow rule.
  return (
    tool === "Bash" &&
    (/[^\x20-\x7e]|[;&|<>$`\\"'(){}\[\]?*~#!]/.test(input) ||
      !input.trim() ||
      input !== input.trim() ||
      /^(?:[A-Za-z_][A-Za-z0-9_]*=|(?:watch|setsid|ionice|flock|find|timeout|time|nice|nohup|stdbuf|command|builtin|noglob|xargs)(?:\s|$))/.test(
        input,
      ))
  );
}

export function runPolicyTests(
  policy: Policy,
  config: PolicyTestConfig,
): PolicyTestReport {
  const validated = parseTestConfig(JSON.stringify(config));
  let work = 0;
  const results = validated.cases.map((item) => {
    work +=
      (item.input.length + 1) *
      policy.rules
        .filter((rule) => rule.tool === item.tool)
        .reduce((sum, rule) => sum + rule.pattern.length + 1, 0);
    if (work > 10_000_000)
      throw new Error("Policy assertion work limit exceeded (10000000 units)");
    const actual = unsupportedQuery(item.tool, item.input)
      ? {
          decision: "UNKNOWN" as const,
          reason:
            "Policy assertion query uses unsupported Bash syntax; commands are never executed",
          evidence: [],
        }
      : evaluate(policy, item.tool, item.input);
    return {
      ...item,
      actual,
      status:
        actual.decision === "UNKNOWN"
          ? ("unknown" as const)
          : actual.decision === item.expected
            ? ("passed" as const)
            : ("mismatch" as const),
    };
  });
  return {
    schemaVersion: 1,
    provider: "claude-code",
    scope: "tracked-project-rule-policy",
    command: "test",
    revision: policy.revision,
    complete: false,
    passed: results.every((result) => result.status === "passed"),
    results,
    issues: policy.issues,
  };
}
