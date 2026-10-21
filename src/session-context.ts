import type { Decision, Evaluation, Evidence, Policy } from "./types.ts";
import { evaluate } from "./policy.ts";

/** Explicit facts supplied by the caller, never inferred from a Git revision. */
export interface SessionContext {
  /** Is this project trusted in the session actually under review? */
  projectTrust: "trusted" | "untrusted" | "unknown";
  /** Whether the live session uses Claude Code's manual/default mode. */
  permissionMode: "default" | "other" | "unknown";
  /**
   * Whether other permission settings, session overrides, hooks or approvals
   * can affect the decision. "none" is a caller assertion, not verification.
   */
  externalInfluences: "none" | "present" | "unknown";
}

export interface ContextualEvaluation {
  /**
   * Conditional result of the tracked project rules, independently replayable
   * and NEVER a runtime authorization verdict.
   */
  modeled: Evaluation;
  /** Conservative contextual view; UNKNOWN unless every premise is asserted. */
  contextual: Evaluation;
  /** Which required premises are not established. */
  unresolved: readonly (keyof SessionContext)[];
  /** Always false: runtime behavior is not modeled by this API. */
  runtimeVerified: false;
}

const causes: Record<keyof SessionContext, string> = {
  projectTrust: "Project trust is not established for the inspected session",
  permissionMode: "The live permission mode is not established as default/manual",
  externalInfluences: "External settings, hooks or runtime approvals are unresolved",
};

export function evaluateWithContext(
  policy: Policy,
  tool: string,
  input: string,
  context: SessionContext,
): ContextualEvaluation {
  // Validate at runtime too: JS consumers can bypass TypeScript declarations.
  if (
    !context ||
    !["trusted", "untrusted", "unknown"].includes(context.projectTrust) ||
    !["default", "other", "unknown"].includes(context.permissionMode) ||
    !["none", "present", "unknown"].includes(context.externalInfluences)
  ) {
    throw new Error("Invalid explicit session context");
  }
  const modeled = evaluate(policy, tool, input);
  const unresolved = ([
    ["projectTrust", context.projectTrust !== "trusted"],
    ["permissionMode", context.permissionMode !== "default"],
    ["externalInfluences", context.externalInfluences !== "none"],
  ] as const)
    .filter(([, unresolved]) => unresolved)
    .map(([name]) => name);
  if (unresolved.length === 0)
    return { modeled, contextual: modeled, unresolved, runtimeVerified: false };
  const contextual: Evaluation = {
    decision: "UNKNOWN",
    reason: unresolved.map((name) => causes[name]).join("; "),
    evidence: modeled.evidence,
  };
  return { modeled, contextual, unresolved, runtimeVerified: false };
}
