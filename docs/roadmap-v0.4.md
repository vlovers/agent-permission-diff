# RuleWitness v0.4 — proposed roadmap

Status: **in progress, unreleased**. See [release readiness](release-readiness-v0.4.md) and [unreleased changelog](../CHANGELOG.md). No v0.4 npm release commitment. Baseline: published v0.3.0. Nothing in this plan expands the existing Claude Code runtime claims. [v0.3 roadmap](roadmap-v0.3.md) is retained as historical release planning.

## Goal

Improve adoption and validate a careful provider-extension architecture **without** claiming that Claude Code rules apply to other AI tools. Prioritize verifiable behavior over broad but speculative support.

## Phase 1 — evidence and compatibility

- Audit the current CLI/library API, published package, documented settings subset, known unsafe assumptions, and security boundaries.
- Build executable disposable-repository consumer fixtures for normal PRs, fork PRs, missing commit objects, unsupported syntax, and sensitive output.
- Verify CI, package installation and the public example using exact refs. Record real run links and limitations; do not mark missing cases as tested.
- Improve operational docs, platform requirements, and exit-code troubleshooting without changing schema v1.

**Acceptance:** reproducible fixtures, tests passing on Node.js 24, no command execution from examined policies, explicit uncertainty.

## Phase 2 — provider-neutral reporting (design first)

- Inventory what the existing CLI, policy types, parser and comparator assume about Claude-specific rules.
- Specify a **versioned provider identity** on future report data while preserving v1 consumers and the current CLI by default.
- Define adapter interfaces with separate detection, loading, validation, and evaluation responsibilities. Reject unknown providers, ambiguous auto-detection, and unsupported rules.
- Keep evidence, bounded witness generation, deterministic ordering and `complete: false` where coverage remains partial.
- Review backwards compatibility, threat models and potential maintenance burden before implementation.

**Acceptance:** a written design with compatibility tests; no unverified provider claims.

## Phase 3 — first additional provider only after research

Select one provider **only if** its documented configuration and precedence semantics can be modeled and independently tested. Otherwise publish a feasibility report rather than a misleading implementation. Consider Codex or other coding agents as candidates, not supported products.

- Link version-specific primary documentation; capture representative positive/negative fixtures.
- Test precedence, inheritance, unknown syntax, defaults and configuration locations against confirmed behavior where possible.
- Support provider-specific uncertainty instead of mapping unknown decisions to `ALLOW`.
- Ship behind an explicit provider selection and experimental label until adequately validated.

**Acceptance:** independent tests, versioned reference evidence, CLI and package smoke tests, threat-model review and clear documented limitations.

## Phase 4 — developer adoption

- Build a copy-pasteable minimal repository integration and tested `npm exec` / `npx` flow.
- Improve short documentation and real examples; compare competitor approaches accurately without unsupported differentiation claims.
- Evaluate optional PR comments separately: no write-token execution of untrusted PR code; preserve redaction and permissions safety.
- Gather early user feedback before adding more plugins or provider adapters.

## Release gate

No tag or npm publication until the code, docs, tests and package smoke checks pass and maintainer review is complete. Keep changes reviewable in dedicated PRs; never silently change v0.3 JSON v1, severity gates or exit statuses.
