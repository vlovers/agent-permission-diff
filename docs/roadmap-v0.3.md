# RuleWitness v0.3.0 — audit and implementation roadmap

Audit date: 2026-10-18. Baseline: `760e61df9ee600da56b9d43891bd381b5e4f9913` (`main`).
Scope: repository and published v0.2.0; **this document makes no new provider-conformance claims**.

## Verified baseline

- Package: `rulewitness@0.2.0`, MIT, ESM / Node 24, experimental pre-release, npm package and compatibility bin `agent-permission-diff`.
- Entrypoints: `scan [REV]`, `compare BEFORE AFTER [--fail-on high|medium|low|info]`, `test [--config FILE] [--rev REV]`; human, JSON v1 and Markdown output. There is no native `pr` subcommand.
- Library: `readPolicy`, `parsePolicy`, `evaluate`, `comparePolicies`, `scanPolicy`, `validateWitness`, explanations, severity gate, Markdown/human formatting, policy assertions. Preserve their contracts.
- Semantics: two tracked, root-level settings files; documented subset of Bash patterns and bare WebSearch; deny > ask > allow; no shell interpretation; partial coverage, including universal `complete: false`; unknown is not a pass.
- Comparison: symbolic glob regions with bounded work, replay-checked witnesses, masked/no-op suppression, coverage findings under unknowns, stable scoped gate exit codes 0/1/2/3.
- Security: fixed-argv read-only Git operations, no checkout or fetch, disabled Git transports/lazy fetch and external configuration, strict UTF-8, symlink rejection, input limits, inert reporting.
- Tests: policy/model cases, independent wildcard oracle, 200 deterministic policy pairs over bounded exhaustive input corpus, Git abuse tests, CLI tests, installed-package smoke tests. Current CI runs typecheck, tests, build, package tests, formatting and scan under read-only permissions.
- Workflows: `.github/workflows/ci.yml` and a release-triggered npm OIDC publisher. Latest observed push CI passed on the baseline SHA ([run](https://github.com/vlovers/rulewitness/actions/runs/39034143184)). This is not a newly run verification of v0.3.
- Releases: [v0.1.0](https://github.com/vlovers/rulewitness/releases/tag/v0.1.0) (historical AgentPermissionDiff) and [experimental v0.2.0](https://github.com/vlovers/rulewitness/releases/tag/v0.2.0).

## Concrete UX gap

The current Markdown renderer wraps the human report in a single fenced block. It is injection-resistant, but a long PR diff is hard to scan: no compact counts, table of changes, or visually separated uncertainty. The CLI can compare two locally present Git SHAs already; no new diff engine is needed. Documentation warns users to use a read-only `pull_request` checkout but does not include a tested copy/paste PR workflow. The repository's own CI does not act as a consumer example.

## Competition and positioning

- [agent-context-diff](https://github.com/cosmichackerx/agent-context-diff) documents GitHub Action / PR-oriented reporting and broader configuration review.
- [agent-permission-diff](https://github.com/DebadityaHait/agent-permission-diff) documents provider-neutral snapshots, policy checks and reporting.
- [agent-permissions](https://github.com/Mearman/agent-permissions) documents cross-agent normalization/evaluation and synchronization.

Git integration, CI gates, explanation and policy assertions are *not unique*. RuleWitness focuses on replay-checked concrete witnesses and conservative unknowns for its narrow modeled subset. Competitor capabilities are based on published descriptions, not provider-runtime conformance testing.

## PR sequence (independent changes, no merges without approval)

1. **docs/v0.3-audit-roadmap** — this baseline, explicit acceptance criteria and non-goals. No runtime behavior changes.
2. **feat/v0.3-pr-markdown** — structured reviewer-friendly Markdown, summary counts, separated known and uncertain findings, bounded output and Markdown-injection regression tests. Keep JSON v1 and CLI gate logic intact; retain complete: false in every view.
3. **docs/v0.3-github-pr-workflow** — tested, copyable read-only `pull_request` GitHub Actions workflow; explicit base/head SHAs and full necessary Git history; report to `GITHUB_STEP_SUMMARY`; preserve exit codes and failed reports without executing checked-out package scripts. Document fork behavior and checkout trust boundaries.
4. **feat/v0.3-pr-comment** — *conditional*, only if a threat model establishes a safe low-privilege comment-writing architecture. Never combine untrusted code checkout/execution with elevated write privileges.
5. **test/v0.3-pr-integration** — consumer scenarios: known escalation, deny-masked no-op, unsupported change, invalid refs, absent settings, mixed uncertainty and violation; update README with actual validated output and release checklist.

Each PR should be separately reviewable and branch from `main` (or explicitly note dependencies). Do not merge, tag, or publish automatically. No new providers, runtime-policy authorization, SARIF, shell parser, external API calls or new abstraction layer is planned.

## Security acceptance criteria

- Plain `pull_request`, `contents: read`; pin third-party actions to audited commit SHAs and avoid `pull_request_target` for executing PR content.
- Analyze exact event base and head commits. Do not silently substitute moving `main` or merge `HEAD`; never let unchecked CLI refs be interpreted as options. Prepare both required objects explicitly.
- An untrusted PR can change `package.json` and workflows: consumer examples must use a *trusted pinned released package*, not build or execute the PR's copy of RuleWitness.
- Keep statuses distinct: 1=known gate violation, 2=analysis failure, 3=uncertain scoped gate; an unsuccessful check must not be hidden by report-publication steps.
- Treat report contents as potentially sensitive; no unsolicited public comments/artifacts. Preserve adversarial escaping for Markdown and terminal control characters.
- Verify `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:package`, `npm run format:check`, `npm pack --dry-run`, consumer scenario tests, plus GitHub checks before requesting merge.
- Keep provider limitations prominently linked to [official permissions](https://code.claude.com/docs/en/permissions) and [settings](https://code.claude.com/docs/en/settings); no unsupported claim that `ALLOW` guarantees runtime execution.

## Scope and known unknowns

Settings from users, organizations, managed locations, nested paths, untracked files, worktrees, runtime session and hooks remain outside this model. Arbitrary shell constructs, tool parameter selectors, unverified Claude Code versions, Windows and full provider conformance are not supported. The CI outcome is a **scoped change-review signal, not a security certification**.
