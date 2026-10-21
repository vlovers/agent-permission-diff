import { parse as parseToml } from "smol-toml";

/**
 * Experimental Codex project-config posture inventory.
 * NOT a permission evaluator: no inheritance, user/managed settings,
 * trust, MCP, rules or actual command authorization is established.
 *
 * Standard TOML syntax is parsed, but only a bounded semantic subset is accepted;
 * other syntax produces UNKNOWN instead of guessing a value.
 */
export type CodexPostureKey =
  | "approval_policy"
  | "sandbox_mode"
  | "sandbox_workspace_write.network_access"
  | "sandbox_workspace_write.exclude_slash_tmp"
  | "sandbox_workspace_write.exclude_tmpdir_env_var";
export type CodexPostureValue =
  | "on-request"
  | "never"
  | "read-only"
  | "workspace-write"
  | "danger-full-access"
  | true
  | false;
export interface CodexPosture {
  schemaVersion: 1;
  provider: "codex";
  scope: "tracked-project-config-posture";
  complete: false;
  values: Partial<Record<CodexPostureKey, CodexPostureValue>>;
  issues: readonly string[];
}
export interface CodexPostureComparison {
  before: CodexPosture;
  after: CodexPosture;
  changes: readonly {
    key: CodexPostureKey;
    before: CodexPostureValue | null;
    after: CodexPostureValue | null;
  }[];
  uncertain: boolean;
  runtimePermissionDiff: false;
}
const stringValues = {
  approval_policy: ["on-request", "never"],
  sandbox_mode: ["read-only", "workspace-write", "danger-full-access"],
} as const;
const rootKeys = ["approval_policy", "sandbox_mode"] as const;
const nestedKeys = [
  "network_access",
  "exclude_slash_tmp",
  "exclude_tmpdir_env_var",
] as const;
const keys = [
  "approval_policy",
  "sandbox_mode",
  "sandbox_workspace_write.network_access",
  "sandbox_workspace_write.exclude_slash_tmp",
  "sandbox_workspace_write.exclude_tmpdir_env_var",
] as const;
const MAX_LENGTH = 64 * 1024;
const isObject = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);

export function inspectCodexPosture(content: string): CodexPosture {
  if (
    typeof content !== "string" ||
    Buffer.byteLength(content, "utf8") > MAX_LENGTH
  )
    throw new Error("Codex config input exceeds safe limit or is not text");
  const issues: string[] = [];
  const result: CodexPosture = {
    schemaVersion: 1,
    provider: "codex",
    scope: "tracked-project-config-posture",
    complete: false,
    values: {},
    issues,
  };
  let document: unknown;
  try {
    document = parseToml(content);
  } catch {
    // Do not expose raw TOML parse errors: they can embed credentials.
    return { ...result, issues: ["Invalid or unsupported TOML document"] };
  }
  if (!isObject(document))
    return { ...result, issues: ["TOML document is not an object"] };

  for (const [key, value] of Object.entries(document)) {
    if (key === "sandbox_workspace_write") {
      if (!isObject(value)) {
        issues.push("Unsupported sandbox_workspace_write table");
        continue;
      }
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (!nestedKeys.includes(nestedKey as (typeof nestedKeys)[number])) {
          issues.push("Unmodeled workspace-write setting");
        } else if (typeof nestedValue !== "boolean") {
          issues.push("Workspace-write setting must be a boolean");
        } else {
          result.values[
            `sandbox_workspace_write.${nestedKey}` as CodexPostureKey
          ] = nestedValue;
        }
      }
    } else if (!rootKeys.includes(key as (typeof rootKeys)[number])) {
      issues.push("Unmodeled Codex configuration setting");
    } else if (
      typeof value !== "string" ||
      !stringValues[key as (typeof rootKeys)[number]].includes(value as never)
    ) {
      issues.push("Unsupported Codex setting value");
    } else {
      result.values[key as CodexPostureKey] = value as CodexPostureValue;
    }
  }
  // Never compare a partially understood config as a known posture.
  if (issues.length) return { ...result, values: {} };
  return result;
}
export function compareCodexPosture(
  before: CodexPosture,
  after: CodexPosture,
): CodexPostureComparison {
  if (
    before.provider !== "codex" ||
    after.provider !== "codex" ||
    before.schemaVersion !== 1 ||
    after.schemaVersion !== 1
  )
    throw new Error("Expected two Codex posture inventories");
  const uncertain = before.issues.length > 0 || after.issues.length > 0;
  const changes = uncertain
    ? []
    : keys.flatMap((key) => {
        const left = before.values[key] ?? null,
          right = after.values[key] ?? null;
        return left === right ? [] : [{ key, before: left, after: right }];
      });
  return { before, after, changes, uncertain, runtimePermissionDiff: false };
}
