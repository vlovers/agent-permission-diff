# RuleWitness v0.2.0 — experimental release candidate

**Semantic Permission Diff for AI Coding Agents**

Detect, explain, and test Claude Code permission changes across Git revisions.

Status: prepared for review, **not published**. Repository: [vlovers/agent-permission-diff](https://github.com/vlovers/agent-permission-diff). Feature branch: `feat/rulewitness-v0.2`. Main history and the existing v0.1 tag are preserved.

## Release notes

- Rename the candidate package to `rulewitness@0.2.0`, with a new `rulewitness` executable and the legacy executable as an alias. Keep ESM, Node.js 24 and zero runtime dependencies.
- Explain modeled decisions from determining evidence, with source file, JSON pointer, revision, rule, certainty and limitations. Keep JSON v1 fields; add optional structured explanation data and an explicit opt-in gate result.
- Retain bounded symbolic wildcard comparison and semantic noise filtering; replay every transition witness and deduplicate coverage evidence. A separate dynamic-programming oracle now independently verifies witnesses and finite-corpus changes for 200 seeded policy pairs.
- Add validated, reusable policy assertions, explicit revision selection, expected/actual decisions, evidence, and failure on unknown results. Test inputs are never executed.
- Add deterministic Markdown and opt-in severity gates with separate threshold, error and uncertainty exits. Mixed reports expose both threshold violations and uncertainty; uncertainty retains exit precedence. SARIF is deferred.
- Extend adversarial/oracle/consumer coverage and install package tests outside the source repository, including both bins and declarations. Preserve all earlier tests.

This remains a configured-rule analyzer for a narrow Claude Code subset. It is not a generic AI security scanner, multi-provider converter, runtime permission emulator or enforcement tool. See the [final technical review](final-review-v0.2.md), [maintainer metadata/rename checklist](github-rename.md), [migration](migration-v0.2.md), [research/differentiation](rulewitness-research.md), and the README's exact supported/unsupported boundary.

## Name and publication readiness

Direct npm registry GETs returned 404/no public entry for `rulewitness`, `@vlovers/rulewitness` and `agent-rule-witness` on 2026-10-17. Use `rulewitness` as the release candidate name. A 404 does not reserve a name, establish trademark rights, bypass npm package-name policy, or prove this account can publish. If it becomes unavailable or cannot be verified at publication time, retain provisional status and select/review an alternative before publishing.

After a separately authorized publication, the intended installation is `npm install --save-dev rulewitness@0.2.0`. No npm publish, GitHub release, release tag, repository rename, security-setting change or automatic merge is part of this PR.

## Publishing checklist for a future authorized release

1. Follow the [ordered rename checklist](github-rename.md) if the owner authorizes the planned GitHub rename; keep all existing URLs valid until then. Review and merge the PR through the normal protected-main process; verify remote CI for the exact commit.
2. Recheck registry availability and ownership without printing authentication tokens. Confirm npm publishing account, required 2FA/provenance and project metadata through the maintainer's normal process. Name checks are not publication permission.
3. Verify private vulnerability reporting and a responsible notification/security owner. Do not claim it is enabled merely because SECURITY.md links to it. No private contact guarantee or response SLA is established here.
4. Run typecheck, every source/integration test, production build, installed-package tests, formatting and `npm pack --dry-run`. Inspect the candidate contents. Use a fresh checkout or explicit build; `prepack` runs the build for ordinary packing.
5. Inspect the actual tarball installed offline in a separate consumer. Check executable aliases, ESM API, TypeScript declarations, no runtime dependencies, and absence of source fixtures, secrets, caches, Git/IDE metadata and node_modules.
6. Review migration notes and experimental limitations. Do not advertise runtime completeness, native compatibility or Windows support without new validation.
7. Only after explicit authorization, follow the maintainer's release procedure. npm publication, GitHub Release creation and pushing version tags each require their own authorization; none is automated by this code.

## Package and platform contract

Local validation: **54 passing tests** (43 source/unit/integration tests and 11 installed-package tests), typecheck, production build, formatting and package smoke checks. The existing 35 tests were retained; exact-key assertions were extended for the documented additive explanation field, not weakened. The package dry-run manifest contains **44 files**, including 20 generated JS/declaration files, five root package/license/documentation files and 19 documentation/example files. Offline consumer installation and TypeScript declaration compilation run outside the source repository.

Read-only GitHub checks on 2026-10-17 verified private vulnerability reporting enabled and main protected. This task did not modify either setting. Responsible security-notification ownership and the candidate's remote CI/review must still be confirmed. The ordinary package dry-run can require an authorized retry where npm's cache is sandbox-blocked; no cache ownership change or registry publication is part of validation.

The allowlisted package contains package.json, README, MIT LICENSE, SECURITY, CONTRIBUTING, generated JS/declarations for the parser, evaluator, Git reader, matcher, comparison, explanations, assertions, renderers and CLI, plus documentation/captured examples. It excludes `.idea`, `.git`, `.github`, source tests/fixtures, source TypeScript, caches, node_modules and the lockfile. Historical v0.1 documents remain clearly identified as historical.

Local validation targets macOS and CI targets Linux using Node.js 24. Windows shell/bin/symlink behavior is unverified. Git must support `--no-lazy-fetch`; older Git fails closed. Installed consumers need no TypeScript loader and no runtime npm dependencies. The independent declaration test uses TypeScript as a development check, not a consumer runtime requirement.

## Remaining limitations and blockers

- Full runtime claims remain blocked by unsupported shell/runtime checks, settings scopes, modes, other tools and lack of installed-Claude-Code conformance/version validation. Known raw allowances are not execution guarantees. Broad raw patterns can cover unsupported runtime inputs.
- Assertion queries deliberately have a narrower syntax boundary than raw matching. Passing tests cover the listed queries only; unknown never passes. Resource limits can reject large/adversarial suites or policies.
- The analyzer does not redact supported permission strings; reports can contain sensitive data already present in settings. Coverage fingerprints are not secret protection. Git/repository metadata are trusted, not sandboxed.
- Public npm readiness requires maintainer review, remote CI, verified name/ownership, and a private disclosure channel. Runtime libraries keep universal `complete: false`; a scoped gate does not certify external/runtime safety.

## Suggested announcement (after approval only)

> RuleWitness 0.2.0 is an experimental, offline permission-policy diff and testing tool for Claude Code's supported configuration-rule semantics. It explains changes with replay-checked witnesses and determining-rule evidence, filters modeled no-ops, and runs reusable assertions. JSON/Markdown reports and explicit uncertainty exits support review pipelines. It does not authorize runtime execution or promise complete Claude Code compatibility. This evolves AgentPermissionDiff in the same repository; see the migration notes before updating imports or CLI parsing.

## Prepared GitHub Release description (do not create yet)

Title: **RuleWitness v0.2.0 — experimental**

RuleWitness provides semantic permission diffs and policy tests for the documented Claude Code configuration subset. This evolves AgentPermissionDiff in the same Git history.

- Explain ASK → ALLOW changes with a concrete witness, both modeled decisions and determining-rule evidence.
- Filter supported equivalent and deny-masked changes; retain UNKNOWN and coverage diagnostics.
- Replay transition witnesses and independently test the matcher against a separate reference oracle.
- Run policy assertions with `rulewitness test`; UNKNOWN never passes an assertion.
- Use JSON/Markdown reports and `--fail-on high`; mixed severity and uncertainty remain separate structured facts.
- Node.js 24, ESM exports/declarations, an installed-package consumer check and no runtime dependencies.

After npm publication has actually been verified:

```sh
npm install --save-dev rulewitness@0.2.0
npx --no-install rulewitness scan HEAD
npx --no-install rulewitness compare main HEAD --json --fail-on high
npx --no-install rulewitness test --rev HEAD
```

**Experimental:** this models a limited configured-rule subset, not runtime authorization. ALLOW does not guarantee execution. External settings, shell/runtime normalization, unsupported tools/settings, native provider version conformance and Windows support remain unverified. All reports retain `complete: false`. See the README, migration notes and known limitations before adoption. The legacy executable alias remains for the v0.2 migration.

Do not claim the installation commands work from npm until the separately authorized package publication is confirmed. Do not attach unreviewed generated assets or create a release/tag as part of this preparation.

## Short launch announcement (after verified publication only)

> RuleWitness v0.2.0 (experimental): Semantic Permission Diff for AI Coding Agents. Review Claude Code permission changes across Git revisions with concrete counterexamples, determining-rule evidence and reusable policy tests. Offline, TypeScript, no runtime dependencies. It models a documented subset and keeps uncertainty visible; it does not guarantee runtime authorization. Install `rulewitness@0.2.0` after publication and read the supported-scope notes before using CI gates.
