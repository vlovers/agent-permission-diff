# RuleWitness v0.2 research and implementation plan

Reviewed 2026-10-17, before implementation. Baseline: `1e9d18788a92bc942097b6050576a1550fc9e96f` on `main`. Fetch found no newer main commit; it discovered existing Dependabot branches and `v0.1.0`, which are preserved. Work continues on `feat/rulewitness-v0.2`. The unrelated untracked `.idea/` directory is untouched.

## Existing repository audit

The repository contains an ESM Node.js 24 TypeScript library and CLI, eight source modules, 28 source tests and seven installed-package tests. The CLI scans/compares committed project settings, emits human/JSON v1 reports, and uses exit 0 for reports and 2 for errors. `index.ts` exports parsing, evaluation, Git loading, scan/compare, severity and human formatting. A bounded glob-NFA product enumerates acceptance regions. Evidence includes revision, path and JSON pointer. Unknown settings deliberately prevent known decisions, and changes beneath stable unknowns remain visible as coverage findings.

The Git reader uses fixed argv operations, resolved commit IDs, strict UTF-8, regular-blob checks, environment scrubbing, disabled transports and no lazy fetch. It does not checkout revisions or execute analyzed commands. The MIT package includes generated JS/declarations, README, SECURITY, CONTRIBUTING and docs. CI runs typecheck, source tests, build, installed-tarball tests and formatting. Release/audit documents explicitly exclude runtime-complete authorization claims and unverified Windows/provider compatibility.

Preserve: all existing tests, historical evidence, the NFA matcher and limits, severity table, JSON v1 fields, read-only Git boundaries, offline runtime, default scan/compare exit behavior, package consumer tests and explicit partial coverage. Improve: evidence-derived explanations, witness replay validation, report usability, duplicate coverage evidence, Markdown reporting and opt-in CI decisions. Extend: validated permission assertions using the same loaded policies and evaluator. No provider expansion or runtime shell parser is planned.

## Related projects

Descriptions reflect the current projects' own published documentation, not independent verification of every claim or an exhaustive feature comparison.

| Project                                                                                       | Documented capabilities                                                                                                                                   | Consequence for positioning                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [DebadityaHait/agent-permission-diff](https://github.com/DebadityaHait/agent-permission-diff) | Provider-neutral permission snapshots/diffs for Claude, Codex and Cursor; source/confidence evidence; policy checks; explain command; JSON/Markdown/SARIF | Semantic permission reviews, explanations, offline operation and CI formats are not unique to RuleWitness                                                      |
| [cosmichackerx/agent-context-diff](https://github.com/cosmichackerx/agent-context-diff)       | Git-ref context/config diffs; MCP/permission/guardrail/Unicode review rules; severity thresholds, structured formats and GitHub Action                    | Git-aware change review and severity gates already exist; RuleWitness should remain narrower than a general context security scanner                           |
| [Mearman/agent-permissions](https://github.com/Mearman/agent-permissions)                     | Cross-agent policy format, deny-first evaluator/explanations, layered loading, conversion and synchronization                                             | Evaluation, precedence and policy reuse are established features; this project will not compete by inventing provider mappings or writing native configuration |

RuleWitness's technical emphasis is a small, inspectable combination: symbolic counterexamples over a declared raw rule language; witnesses replayed against both policy evaluators; suppression of modeled-equivalent changes; uncertainty retained when proof is unavailable; Git revision evidence; and assertions against the same conservative model. These are verifiable implementation properties, not a claim of industry-wide uniqueness or runtime enforcement.

## Official provider sources

- [Claude Code permissions](https://code.claude.com/docs/en/permissions): deny/ask/allow precedence, exact matching, Bash stars and prefix boundaries, parameter selectors, wrappers, runtime restrictions and defaults. The supported raw matching subset remains unchanged. A modeled allow is not execution authorization.
- [Claude Code settings](https://code.claude.com/docs/en/settings): project/local sources, array merging, external precedence, workspace/worktree discovery and invalid-file recovery. Only root-level tracked snapshots are inspected; those extra runtime scopes stay explicitly outside the model.

Provider docs are live and no installed Claude Code conformance range has been established. Unreliable semantics remain unknown or unsupported. Policy assertions will reject unsupported query syntax as unknown rather than approving commands based on a broad raw rule. This is a conservative assertion boundary, not shell interpretation.

## Registry and branding

Direct unauthenticated GETs to `https://registry.npmjs.org/rulewitness`, `https://registry.npmjs.org/%40vlovers%2Frulewitness`, and `https://registry.npmjs.org/agent-rule-witness` returned HTTP 404 with `{"error":"Not found"}` on 2026-10-17. Select `rulewitness` for the 0.2.0 candidate. This establishes no current public registry entry, not a reservation or guarantee of publish authorization. Recheck before any separately authorized publication.

Keep the GitHub location `vlovers/agent-permission-diff`. Retain the old bin name as a compatibility alias. Preserve old library function names and JSON v1 fields; document additive explanation fields and the separate versioned assertion-report contract. Historical v0.1 audits remain historical records, not silently rewritten claims about v0.2.

## CI and release choices

Opt-in severity gates distinguish threshold findings (1), analysis/usage errors (2), and unresolved inspected-model coverage (3); no flag preserves legacy report-only behavior. `complete: false` remains universal because external runtime semantics are not modeled. A scoped gate is not a full security pass. Policy assertions never pass on unknown, even if the expected decision is unknown. SARIF is deferred: Markdown and JSON are enough for the focused release without inventing code-scanning semantics.

Installed-package tests must cover exports, declarations, both bin names, new commands and failure codes from a separate consumer. Existing assertions are preserved or extended for intentional output/schema additions. No publication, release, tag, merge, repository rename or settings mutation is part of this task; only the feature branch and PR will be pushed/opened after validation.
