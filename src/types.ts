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
}
