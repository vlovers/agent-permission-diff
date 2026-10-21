import { evaluate } from "./policy.ts";
import { inventoryPermissionSources } from "./permission-sources.ts";
import type {
  PermissionSource,
  PermissionSourceInventory,
  PermissionSourceKind,
} from "./permission-sources.ts";
import type { ContextualEvaluation, SessionContext } from "./session-context.ts";
import type { Evaluation, Policy } from "./types.ts";

/**
 * Source-aware review of the modeled tracked-rule outcome.
 * No settings are opened, merged, executed, or assumed to have runtime precedence.
 */
export interface SourceAwareEvaluation extends ContextualEvaluation {
  inventory: PermissionSourceInventory;
  /** Uninspected sources that block any positive runtime interpretation. */
  unresolvedSources: readonly PermissionSourceKind[];
}

/**
 * This is a conservative evidence gate, not an implementation of Claude
 * Code's managed/user/project/local precedence. In particular an absent
 * tracked file never proves the corresponding runtime source is absent.
 *
 * Caller-supplied "absent-asserted" remains an unverified assertion.
 * Even fully asserted inputs never make runtimeVerified true.
 */
export function evaluateWithSources(
  policy: Policy,
  tool: string,
  input: string,
  context: SessionContext,
  externalSources: readonly PermissionSource[] = [],
): SourceAwareEvaluation {
  const inventory = inventoryPermissionSources(policy, externalSources);
  if (
    !context ||
    !["trusted", "untrusted", "unknown"].includes(context.projectTrust) ||
    !["default", "other", "unknown"].includes(context.permissionMode) ||
    !["none", "present", "unknown"].includes(context.externalInfluences)
  )
    throw new Error("Invalid explicit session context");

  const modeled = evaluate(policy, tool, input);
  const unresolved = ([
    ["projectTrust", context.projectTrust !== "trusted"],
    ["permissionMode", context.permissionMode !== "default"],
    ["externalInfluences", context.externalInfluences !== "none"],
  ] as const)
    .filter(([, missing]) => missing)
    .map(([key]) => key);
  const unresolvedSources = inventory.sources
    .filter((source) =>
      source.availability === "unknown" ||
      source.availability === "present-uninspected",
    )
    .map((source) => source.kind);

  if (unresolved.length === 0 && unresolvedSources.length === 0) {
    return {
      modeled,
      contextual: modeled,
      unresolved,
      unresolvedSources,
      inventory,
      runtimeVerified: false,
    };
  }
  const parts: string[] = [];
  if (unresolved.includes("projectTrust"))
    parts.push("Project trust is not established");
  if (unresolved.includes("permissionMode"))
    parts.push("Session permission mode is not established");
  if (unresolved.includes("externalInfluences"))
    parts.push("External influences are not ruled out");
  if (unresolvedSources.length)
    parts.push("Uninspected permission sources: " + unresolvedSources.join(", "));
  const contextual: Evaluation = {
    decision: "UNKNOWN",
    reason: parts.join("; "),
    evidence: modeled.evidence,
  };
  return {
    modeled,
    contextual,
    unresolved,
    unresolvedSources,
    inventory,
    runtimeVerified: false,
  };
}
