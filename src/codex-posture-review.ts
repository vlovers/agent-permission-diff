import type { CodexPosture, CodexPostureComparison } from "./codex-posture.ts";
import { compareCodexPosture } from "./codex-posture.ts";

export type CodexPostureDirection =
  | "broader-configured-sandbox"
  | "narrower-configured-sandbox"
  | "fewer-approval-prompts"
  | "more-approval-prompts"
  | "mixed"
  | "unchanged"
  | "unknown";

export interface CodexPostureReview {
  schemaVersion: 1;
  provider: "codex";
  scope: "tracked-project-config-posture";
  direction: CodexPostureDirection;
  /** Names of unmodeled or missing premises. No raw configuration is exposed. */
  unresolved: readonly string[];
  /** Canonical, bounded input comparison; never a runtime permission diff. */
  comparison: CodexPostureComparison;
  runtimePermissionDiff: false;
  runtimeVerified: false;
}

const SANDBOX_ORDER = ["read-only", "workspace-write", "danger-full-access"] as const;

/**
 * Classify only explicit configured posture transitions; no live authorization,
 * approval escalation or effective-permission inference is attempted.
 *
 * A changed sandbox mode is an ordinal *configuration* observation, not proof
 * about file/network access. Approval prompt policy is a separate dimension.
 */
export function reviewCodexPosture(
  before: CodexPosture,
  after: CodexPosture,
): CodexPostureReview {
  const comparison = compareCodexPosture(before, after);
  const unresolved: string[] = [];
  const signals: CodexPostureDirection[] = [];
  if (comparison.uncertain) unresolved.push("Unsupported Codex configuration");
  const oldSandbox = before.values.sandbox_mode;
  const newSandbox = after.values.sandbox_mode;
  const oldApproval = before.values.approval_policy;
  const newApproval = after.values.approval_policy;

  if (oldSandbox === undefined || newSandbox === undefined) {
    unresolved.push("Sandbox mode not explicit in both revisions");
  } else {
    const left = SANDBOX_ORDER.indexOf(oldSandbox as (typeof SANDBOX_ORDER)[number]);
    const right = SANDBOX_ORDER.indexOf(newSandbox as (typeof SANDBOX_ORDER)[number]);
    if (left < 0 || right < 0) unresolved.push("Unrecognized sandbox mode");
    else if (left !== right)
      signals.push(right > left ? "broader-configured-sandbox" : "narrower-configured-sandbox");
  }
  if (oldApproval === undefined || newApproval === undefined) {
    unresolved.push("Approval policy not explicit in both revisions");
  } else if (oldApproval !== newApproval) {
    if (oldApproval === "on-request" && newApproval === "never")
      signals.push("fewer-approval-prompts");
    else if (oldApproval === "never" && newApproval === "on-request")
      signals.push("more-approval-prompts");
    else unresolved.push("Unrecognized approval policy");
  }

  // Network permission is only locally interpretable when both documents
  // explicitly configure workspace-write. Otherwise runtime applicability is
  // not established, so no inferred network-access direction is emitted.
  const networkKey = "sandbox_workspace_write.network_access";
  const oldNetwork = before.values[networkKey];
  const newNetwork = after.values[networkKey];
  if (oldSandbox === "workspace-write" && newSandbox === "workspace-write") {
    if (typeof oldNetwork !== "boolean" || typeof newNetwork !== "boolean")
      unresolved.push("Workspace network setting not explicit in both revisions");
    else if (oldNetwork !== newNetwork)
      signals.push(newNetwork ? "broader-configured-sandbox" : "narrower-configured-sandbox");
  } else if (oldNetwork !== newNetwork) {
    unresolved.push("Workspace network setting changed outside a stable workspace-write mode");
  }

  // Treat temporary-directory exclusions as coverage-only. Their actual
  // effect depends on platform, mutable environment and other writable roots.
  for (const key of [
    "sandbox_workspace_write.exclude_slash_tmp",
    "sandbox_workspace_write.exclude_tmpdir_env_var",
  ] as const) {
    if (before.values[key] !== after.values[key])
      unresolved.push("Temporary workspace root configuration changed");
  }

  const direction: CodexPostureDirection =
    unresolved.length > 0
      ? "unknown"
      : signals.length === 0
        ? "unchanged"
        : [...new Set(signals)].length === 1
          ? signals[0]!
          : "mixed";
  return {
    schemaVersion: 1,
    provider: "codex",
    scope: "tracked-project-config-posture",
    direction,
    unresolved: [...new Set(unresolved)],
    comparison,
    runtimePermissionDiff: false,
    runtimeVerified: false,
  };
}
