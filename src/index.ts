export * from "./types.ts";
export {
  parsePolicy,
  evaluate,
  relevantIssues,
  SETTINGS_FILES,
} from "./policy.ts";
export { readPolicy } from "./git.ts";
export { comparePolicies, scanPolicy, severity } from "./compare.ts";
export { formatHuman, formatMarkdown } from "./report.ts";
export { formatPullRequestMarkdown } from "./pr-markdown.ts";
export {
  explainFinding,
  validateWitness,
  comparisonOutcome,
  comparisonExitCode,
  assessComparisonGate,
  hasUncertainty,
  LIMITATIONS,
} from "./explain.ts";
export {
  parseTestConfig,
  readTestConfig,
  runPolicyTests,
} from "./assertions.ts";
export { evaluateWithContext } from "./session-context.ts";
export type {
  SessionContext,
  ContextualEvaluation,
} from "./session-context.ts";
export {
  inventoryPermissionSources,
  comparePermissionSources,
} from "./permission-sources.ts";
export type {
  PermissionSourceKind,
  SourceAvailability,
  PermissionSource,
  PermissionSourceInventory,
  SourceCoverageChange,
  SourceCoverageComparison,
} from "./permission-sources.ts";
export { evaluateWithSources } from "./source-aware-evaluation.ts";
export type { SourceAwareEvaluation } from "./source-aware-evaluation.ts";
