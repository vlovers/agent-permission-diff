# RuleWitness v0.3.0 roadmap

Reviewed: 2026-10-18. Baseline: `760e61df9ee600da56b9d43891bd381b5e4f9913`.

This document audits the published v0.2.0 and plans v0.3.0.
No additional Claude Code runtime compatibility is claimed.

## Baseline audit

- Package: `rulewitness@0.2.0`, MIT, Node.js 24, ESM, experimental release.
- CLI: `scan`, `compare`, `test`; human, JSON v1, and Markdown.
- CLI gates: 0 scoped pass, 1 known violation, 2 analysis error, 3 uncertainty.
- Library: policy loading, evaluation, comparison, concrete witnesses, explanations, assertions, and formatters.
- Scope: tracked root-level Claude Code project and local settings, supported Bash patterns, and bare WebSearch.
- Model: deny before ask before allow, bounded symbolic regions, witness replay, masked no-op filtering, coverage diagnostics.
- Safety: fixed-argument read-only Git, disabled transport and lazy fetch, strict UTF-8, symlink rejection, input limits.
- Tests: independent glob oracle, seeded policy pairs, Git abuse, CLI behavior, installed-package consumer checks.
- CI: Node.js 24 with typecheck, tests, build, installed-package tests, formatting, and CLI scan.
- Release workflow: GitHub Release triggers a separate npm OIDC publishing workflow.

The baseline main CI succeeded in [run 39034143184](https://github.com/vlovers/rulewitness/actions/runs/39034143184).
Existing [v0.1.0](https://github.com/vlovers/rulewitness/releases/tag/v0.1.0) and [v0.2.0](https://github.com/vlovers/rulewitness/releases/tag/v0.2.0) releases remain unchanged.

## Confirmed PR experience gaps

Current Markdown is one fenced human-readable report. It lacks a short
reviewer summary and separately presented known changes versus uncertainty.
There is no verified copyable GitHub PR consumer workflow. Existing CLI
comparison and severity gates must be reused, not reimplemented.

## Related projects

- [agent-context-diff](https://github.com/cosmichackerx/agent-context-diff): Git-aware agent context reviews and GitHub integration.
- [agent-permission-diff](https://github.com/DebadityaHait/agent-permission-diff): multi-provider snapshots, diffing, policies, reporting.
- [agent-permissions](https://github.com/Mearman/agent-permissions): cross-agent permissions format and evaluation.

These descriptions summarize published project documentation. They are
not independent runtime conformance tests. Git-aware review, policy
assertions, reporting, and severity gates are not unique to RuleWitness.

RuleWitness differentiates by replay-checked concrete decision witnesses,
modeled no-op suppression, and explicit uncertainty in a narrow rule model.

## Independent pull requests

1. **Audit and roadmap:** this document and acceptance criteria.
2. **PR Markdown:** structured summary, counts, proven changes, uncertainty, and Markdown injection tests.
3. **GitHub workflow:** read-only `pull_request`, exact base/head commit IDs, pinned published CLI, job summary, safe failure behavior.
4. **Optional comments:** only with a validated low-privilege threat model; never execute PR code under write credentials.
5. **Consumer validation:** escalation, masked changes, unknowns, invalid Git refs, missing settings, mixed gates, and release checklist.

PR branches start from main and remain independently reviewable.
No merge, tag, or publishing without maintainer approval.

## Security acceptance criteria

- Preserve existing library exports, JSON v1, and exit codes.
- Never execute a command or package script taken from the analyzed PR.
- Do not use `pull_request_target` to run contributor code.
- Use read-only permissions and exact event commit identifiers.
- Do not silently replace missing Git commit objects with branch tips.
- Keep uncertainty and reliable threshold findings separately visible.
- Do not publish potentially sensitive settings in comments by default.
- Retain bounded analysis, strict decoding, inert input, and error handling.
- Validate typecheck, tests, build, package consumers, formatting, and CI.

## Explicit limitations

Not modeled: full Claude Code runtime authorization, user/managed settings,
nested and untracked files, session approvals, external hooks, arbitrary
shell interpretation, extra tools, provider-version compatibility, or Windows.

See the official [permissions](https://code.claude.com/docs/en/permissions)
and [settings](https://code.claude.com/docs/en/settings) documentation.
All reports must continue to state `complete: false`.
