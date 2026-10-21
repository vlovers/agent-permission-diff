/**
 * Experimental Codex project-config posture inventory.
 * NOT a permission evaluator: no inheritance, user/managed settings,
 * trust, MCP, rules or actual command authorization is established.
 *
 * Only a deliberately restricted, unambiguous TOML subset is accepted;
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
const values: Record<CodexPostureKey, readonly string[]> = {
  approval_policy: ["on-request", "never"],
  sandbox_mode: ["read-only", "workspace-write", "danger-full-access"],
  "sandbox_workspace_write.network_access": ["true", "false"],
  "sandbox_workspace_write.exclude_slash_tmp": ["true", "false"],
  "sandbox_workspace_write.exclude_tmpdir_env_var": ["true", "false"],
};
const keys = [
  "approval_policy",
  "sandbox_mode",
  "sandbox_workspace_write.network_access",
  "sandbox_workspace_write.exclude_slash_tmp",
  "sandbox_workspace_write.exclude_tmpdir_env_var",
] as const;
const MAX_LENGTH = 64 * 1024;
export function inspectCodexPosture(content: string): CodexPosture {
  if (
    typeof content !== "string" ||
    Buffer.byteLength(content, "utf8") > MAX_LENGTH
  )
    throw new Error("Codex config input exceeds safe limit or is not text");
  const result: CodexPosture = {
    schemaVersion: 1,
    provider: "codex",
    scope: "tracked-project-config-posture",
    complete: false,
    values: {},
    issues: [],
  };
  const issues: string[] = [];
  const seen = new Set<string>();
  let section: "root" | "sandbox_workspace_write" | "unsupported" = "root";
  for (const [i, raw] of content.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      if (line === "[sandbox_workspace_write]" && section === "root") {
        section = "sandbox_workspace_write";
      } else {
        section = "unsupported";
        issues.push("Unsupported TOML table (line " + (i + 1) + ")");
      }
      continue;
    }
    const match =
      /^([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(?:"([A-Za-z0-9-]+)"|(true|false))(?:\s*#.*)?$/.exec(
        line,
      );
    if (!match) {
      issues.push("Unsupported TOML syntax (line " + (i + 1) + ")");
      continue;
    }
    const key = section === "sandbox_workspace_write"
      ? `sandbox_workspace_write.${match[1]!}`
      : match[1]!;
    const value = match[2] ?? match[3]!;
    if (seen.has(key)) {
      issues.push("Duplicate TOML key (line " + (i + 1) + ")");
      continue;
    }
    seen.add(key);
    if (section === "unsupported") {
      issues.push("Nested TOML setting not interpreted (line " + (i + 1) + ")");
      continue;
    }
    if (!keys.includes(key as CodexPostureKey)) {
      issues.push("Other Codex setting not interpreted (line " + (i + 1) + ")");
      continue;
    }
    if (
      !values[key as CodexPostureKey].includes(value) ||
      (key.startsWith("sandbox_workspace_write.")
        ? match[3] === undefined
        : match[2] === undefined)
    ) {
      issues.push("Unsupported Codex setting value (line " + (i + 1) + ")");
      continue;
    }
    result.values[key as CodexPostureKey] =
      key === "sandbox_workspace_write.network_access"
        ? value === "true"
        : (value as CodexPostureValue);
  }
  // Unsupported syntax could affect actual parsing of the file. Do not
  // present a partially parsed policy as a known posture.
  if (issues.length) return { ...result, values: {}, issues };
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
