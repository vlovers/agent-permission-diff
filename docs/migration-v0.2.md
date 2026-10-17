# Migrating AgentPermissionDiff v0.1 to RuleWitness v0.2

RuleWitness evolves the existing project and Git history. The repository remains `vlovers/agent-permission-diff`. No repository rename, runtime authorization engine or additional provider is introduced.

| Area                  | v0.1                                | v0.2                                                                                                              |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Candidate npm package | `agent-permission-diff`             | `rulewitness@0.2.0` (not published by this change)                                                                |
| Primary bin           | `agent-permission-diff`             | `rulewitness`; old bin retained as alias in new package                                                           |
| ESM imports           | `from "agent-permission-diff"`      | `from "rulewitness"`; existing exported function names retained                                                   |
| Human output          | AgentPermissionDiff compact reports | RuleWitness explanations, evidence, witness and scope; human output is not a stable parser contract               |
| Scan/compare JSON     | Report schemaVersion 1              | Same required fields, scope, enums and complete flag; optional additive finding.explanation and gated report.gate |
| Exit without flags    | 0 report, 2 error                   | Unchanged for scan/compare; uncertainty still explicit in reports                                                 |
| Opt-in gate           | Not available                       | compare --fail-on: 1 threshold, 3 unresolved model coverage, 2 errors                                             |
| Policy tests          | Not available                       | test: 0 all listed queries passed, 1 mismatch/unknown, 2 invalid config/analysis                                  |

The legacy executable alias does not preserve the old import package name. This repository's v0.1 package was not published by the earlier preparation, and another project's documentation also advertises that package name; do not assume that installing that name retrieves this code. Replace package/import names deliberately.

All existing public parser/evaluator functions retain their raw rule-layer contract. `evaluate()` is not an authorization check. Assertions use that evaluator only for supported simple queries; unsupported Bash query syntax becomes unknown and fails the assertion. This narrower query boundary does not change raw evaluator semantics.

Scan/compare findings preserve `kind`, `tool`, `witness`, `severity`, `before`, `after`; `explanation` adds certainty, summary, steps and limitations. Consumers should allow additive JSON fields and must not rely on reason text, evidence ordering, witness spelling or fingerprints across versions. Assertion reports have their own `schemaVersion: 1`, identified by `command: "test"`; do not parse them as scan/compare reports. The old `Report` TypeScript type remains restricted to scan/compare; `PolicyTestReport` is separate.

Known-to-known transition witnesses are replay-validated before emission. Coverage findings are unresolved configuration messages, not executable counterexamples. Duplicate coverage evidence is now removed. A printable alphanumeric representative is preferred for the automaton's OTHER alphabet class; witness text may change without a semantic change.

Supported Claude Code semantics are not broadened. Unsupported keys/modes, ambiguous parameter rules, other tools, runtime normalization, external settings and source discovery remain unknown or outside inspected scope. Every report keeps `complete: false`. An issue-free modeled no-op is not a runtime safety claim.

For CI, add `--fail-on high` only when prepared to handle exit 3 explicitly. Do not convert exit 3 into success silently. Scope limits remain even on a scoped exit 0. `--fail-on` is rejected on scan/test because inventory entries and assertions have different meanings. Markdown is a safely fenced human report, not SARIF.

Node.js 24, ESM and Git no-lazy-fetch requirements remain. No runtime dependencies or telemetry were added. See [release notes/checklist](release-v0.2.0.md) and [research](rulewitness-research.md).

The v0.2 compatibility executable alias is deliberately retained to avoid breaking scripts while imports and primary examples move to RuleWitness. Removing it now would add an unnecessary migration break; any future removal must be documented separately. Historical attribution remains unchanged.

`assessComparisonGate(report, threshold)` returns independent `thresholdExceeded` and `uncertain` facts, zero-based `violations` indices into the report findings, and `exitCode`. Only known-to-known permission changes qualify as violations. With `--fail-on`, the CLI includes this optional `gate` in JSON v1 and human/Markdown output. Reports without the flag keep their original top-level keys. Exit 3 takes precedence over exit 1 when both facts are true; errors remain exit 2 without a partial report. `comparisonExitCode()` remains available with the same exit behavior. Gate indices are local to that report and are not cross-version finding IDs.
