/**
 * Internal Claude Code bridge for evaluating the existing bounded rule model.
 *
 * This is not a new Claude parser or a replacement for comparePolicies().
 * The generic comparator does not reproduce coverage findings, severity gates,
 * evidence, report ordering, or JSON v1. Keep the existing public path intact.
 * This bridge is internal and does not establish native runtime authorization.
 */
import { regions } from "./glob.ts";
import { evaluate } from "./policy.ts";
import type { Policy } from "./types.ts";
import type { ModelAdapter, ModelDecision } from "./provider-adapter.ts";

const TOOLS = ["Bash", "WebSearch"] as const;
type Tool = (typeof TOOLS)[number];

export function encodeClaudeCandidate(tool: Tool, input: string): string {
  return JSON.stringify([tool, input]);
}

function decodeClaudeCandidate(candidate: string): [Tool, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error("Invalid Claude model candidate");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    !TOOLS.includes(parsed[0] as Tool) ||
    typeof parsed[1] !== "string" ||
    JSON.stringify(parsed) !== candidate
  )
    throw new Error("Invalid Claude model candidate");
  return [parsed[0] as Tool, parsed[1]];
}

/** Symbolic regions and evaluator are reused, never reimplemented. */
export const claudeModelAdapter: ModelAdapter<Policy> = {
  id: "claude-code",
  candidates(before, after) {
    const patterns = [
      ...new Set(
        [...before.rules, ...after.rules]
          .filter((rule) => rule.tool === "Bash")
          .map((rule) => rule.pattern),
      ),
    ].sort();
    return [
      ...regions(patterns).map((input) => encodeClaudeCandidate("Bash", input)),
      encodeClaudeCandidate("WebSearch", "*"),
    ];
  },
  evaluate(snapshot, candidate): ModelDecision {
    const [tool, input] = decodeClaudeCandidate(candidate);
    const result = evaluate(snapshot, tool, input);
    return result.decision === "UNKNOWN"
      ? { kind: "unknown", reason: result.reason }
      : { kind: "known", value: result.decision };
  },
};
