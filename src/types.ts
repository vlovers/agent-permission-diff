export type Decision = "ALLOW" | "ASK" | "DENY" | "UNKNOWN";
export type Severity = "HIGH" | "MEDIUM" | "LOW" | "INFO";
export interface Evidence {
  revision: string;
  file: string;
  pointer: string;
  rule?: string;
}
export interface Rule {
  tool: string;
  pattern: string;
  decision: Exclude<Decision, "UNKNOWN">;
  evidence: Evidence;
}
export interface Issue {
  message: string;
  evidence: Evidence;
  fingerprint: string;
  tool: string | null;
}
export interface Policy {
  revision: string;
  rules: Rule[];
  issues: Issue[];
  files: string[];
}
export interface Evaluation {
  decision: Decision;
  reason: string;
  evidence: Evidence[];
}
export interface Finding {
  kind: "permission" | "coverage";
  tool: string;
  witness: string;
  severity: Severity;
  before: Evaluation;
  after: Evaluation;
  /** Additive JSON v1 field; absent in reports produced before v0.2. */
  explanation?: Explanation;
}
export interface Explanation {
  certainty: "modeled" | "uncertain";
  summary: string;
  steps: string[];
  limitations: string[];
}
export type ComparisonOutcome =
  "modeled-change" | "modeled-no-op" | "uncertain";
export type SeverityThreshold = "high" | "medium" | "low" | "info";
export interface ComparisonGate {
  threshold: SeverityThreshold;
  thresholdExceeded: boolean;
  uncertain: boolean;
  /** Indices into report.findings, restricted to known-to-known transitions. */
  violations: number[];
  /** Uncertainty takes precedence over a threshold violation. */
  exitCode: 0 | 1 | 3;
}
export interface PolicyTestCase {
  name: string;
  tool: string;
  input: string;
  expected: Decision;
}
export interface PolicyTestConfig {
  schemaVersion: 1;
  cases: PolicyTestCase[];
}
export interface PolicyAssertion extends PolicyTestCase {
  actual: Evaluation;
  status: "passed" | "mismatch" | "unknown";
}
export interface PolicyTestReport {
  schemaVersion: 1;
  provider: "claude-code";
  scope: "tracked-project-rule-policy";
  command: "test";
  revision: string;
  complete: false;
  passed: boolean;
  results: PolicyAssertion[];
  issues: Issue[];
}
export interface Report {
  schemaVersion: 1;
  provider: "claude-code";
  scope: "tracked-project-rule-policy";
  command: "scan" | "compare";
  revisions: string[];
  complete: boolean;
  findings: Finding[];
  policies: Policy[];
  /** Additive JSON v1 field, included only for an explicitly requested gate. */
  gate?: ComparisonGate;
}
