import { createHash } from "node:crypto";
import { matches } from "./glob.ts";
import type { Evidence, Evaluation, Issue, Policy, Rule } from "./types.ts";

export const SETTINGS_FILES = [
  ".claude/settings.json",
  ".claude/settings.local.json",
] as const;
const lists = { deny: "DENY", ask: "ASK", allow: "ALLOW" } as const;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function canonical(value: unknown, depth = 0): string {
  if (depth > 64)
    throw new Error("Unsupported configuration exceeds 64 levels of nesting");
  // JSON.parse can produce Infinity from a valid exponent; JSON.stringify
  // would collapse it to null. Keep overflow and signed zero distinguishable.
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return `number:${String(value)}`;
    if (Object.is(value, -0)) return "-0";
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonical(item, depth + 1)).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonical(value[key], depth + 1)}`,
      )
      .join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
export function parsePolicy(
  revision: string,
  files: Record<string, string>,
): Policy {
  const policy: Policy = {
    revision,
    rules: [],
    issues: [],
    files: Object.keys(files).sort(),
  };
  for (const file of policy.files) {
    if (Buffer.byteLength(files[file]!, "utf8") > 2 * 1024 * 1024)
      throw new Error("Settings input exceeds 2 MiB");
    const evidence = (pointer: string): Evidence => ({
      revision,
      file,
      pointer,
    });
    const issue = (
      pointer: string,
      value: unknown,
      message: string,
      tool: string | null = null,
    ): void => {
      policy.issues.push({
        message,
        evidence: evidence(pointer),
        tool,
        fingerprint: createHash("sha256")
          .update(canonical(value))
          .digest("hex"),
      });
    };
    let document: unknown;
    try {
      document = JSON.parse(files[file]!);
    } catch {
      issue("", files[file], "Invalid JSON; provider recovery is not modeled");
      continue;
    }
    if (!object(document)) {
      issue("", document, "Settings must be an object");
      continue;
    }
    for (const [key, value] of Object.entries(document)) {
      if (
        key === "permissions" ||
        (key === "$schema" && typeof value === "string")
      )
        continue;
      issue(
        `/${escapePointer(key)}`,
        value,
        `Unmodeled top-level setting: ${key}`,
      );
    }
    if (document.permissions === undefined) continue;
    if (!object(document.permissions)) {
      issue(
        "/permissions",
        document.permissions,
        "Permissions must be an object",
      );
      continue;
    }
    for (const [key, value] of Object.entries(document.permissions)) {
      const pointer = `/permissions/${escapePointer(key)}`;
      if (
        key === "defaultMode" &&
        typeof value === "string" &&
        ["default", "manual"].includes(value)
      )
        continue;
      if (!Object.hasOwn(lists, key)) {
        issue(pointer, value, `Unmodeled permission setting: ${key}`);
        continue;
      }
      if (!Array.isArray(value)) {
        issue(pointer, value, "Permission list must be an array");
        continue;
      }
      for (const [index, raw] of value.entries()) {
        const location = `${pointer}/${index}`;
        if (typeof raw !== "string" || raw.length > 1000) {
          issue(
            location,
            raw,
            "Rule must be a string of at most 1000 characters",
          );
          continue;
        }
        const parsed = /^([A-Za-z][A-Za-z0-9_]*)(?:\((.*)\))?$/.exec(raw);
        if (!parsed) {
          issue(location, raw, "Unrecognized rule syntax");
          continue;
        }
        const tool = parsed[1]!;
        let pattern = parsed[2] ?? "*";
        if (!["Bash", "WebSearch"].includes(tool)) {
          issue(location, raw, `Unmodeled tool: ${tool}`);
          continue;
        }
        if (tool === "WebSearch" && parsed[2] !== undefined) {
          issue(location, raw, "WebSearch specifiers are not modeled", tool);
          continue;
        }
        if (tool === "Bash") {
          // In ask/deny, a single identifier followed by ':' may name a
          // scalar input parameter. Do not erase that ambiguity as ':*'.
          if (
            key !== "allow" &&
            /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:/.test(pattern)
          ) {
            issue(
              location,
              raw,
              "Ambiguous Bash parameter or legacy prefix rule is not modeled",
              tool,
            );
            continue;
          }
          if (pattern.endsWith(":*")) pattern = pattern.slice(0, -2) + " *";
          if (
            !pattern ||
            /[^\x20-\x7e]|[;&|<>$`\\"'(){}\[\]?]/.test(pattern) ||
            /\w+:/.test(pattern.replace(/:\*/g, ""))
          ) {
            issue(
              location,
              raw,
              "Complex Bash or parameter rule is not modeled",
              tool,
            );
            continue;
          }
          // These literal command forms interact with wrapper removal or
          // exact-vs-wildcard runtime approvals; raw glob inclusion is unsound.
          if (
            /^\s*(?:watch|setsid|ionice|flock|find|timeout|time|nice|nohup|stdbuf|command|builtin|noglob|xargs)(?:\s|$)/.test(
              pattern,
            )
          ) {
            issue(
              location,
              raw,
              "Bash wrapper/find runtime semantics are not modeled",
              tool,
            );
            continue;
          }
        }
        const decision = lists[key as keyof typeof lists];
        const base: Rule = {
          tool,
          pattern,
          decision,
          evidence: { ...evidence(location), rule: raw },
        };
        policy.rules.push(base);
        // A sole trailing space-star also matches the bare prefix, with a word boundary.
        if (
          tool === "Bash" &&
          pattern.endsWith(" *") &&
          pattern.indexOf("*") === pattern.length - 1
        ) {
          policy.rules.push({ ...base, pattern: pattern.slice(0, -2) });
        }
      }
    }
  }
  return policy;
}
function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
export function relevantIssues(policy: Policy, tool: string): Issue[] {
  return policy.issues.filter(
    (issue) => issue.tool === null || issue.tool === tool,
  );
}
export function evaluate(
  policy: Policy,
  tool: string,
  input = "*",
): Evaluation {
  const issues = relevantIssues(policy, tool);
  if (issues.length)
    return {
      decision: "UNKNOWN",
      reason: "Unmodeled configuration affects this tool",
      evidence: issues.map((issue) => issue.evidence),
    };
  if (!["Bash", "WebSearch"].includes(tool))
    return {
      decision: "UNKNOWN",
      reason: "Tool semantics are not modeled",
      evidence: [],
    };
  for (const decision of ["DENY", "ASK", "ALLOW"] as const) {
    const rules = policy.rules.filter(
      (rule) =>
        rule.tool === tool &&
        rule.decision === decision &&
        matches(rule.pattern, input),
    );
    if (rules.length)
      return {
        decision,
        reason: `Matching ${decision.toLowerCase()} rule(s) in deny > ask > allow order`,
        evidence: uniqueEvidence(rules.map((rule) => rule.evidence)),
      };
  }
  return tool === "WebSearch"
    ? {
        decision: "ASK",
        reason: "Manual-mode WebSearch default requires approval",
        evidence: [],
      }
    : {
        decision: "UNKNOWN",
        reason:
          "No matching rule; Bash built-in approvals and runtime checks are not modeled",
        evidence: [],
      };
}
function uniqueEvidence(evidence: Evidence[]): Evidence[] {
  return evidence.filter(
    (item, index) =>
      evidence.findIndex(
        (other) => JSON.stringify(item) === JSON.stringify(other),
      ) === index,
  );
}
