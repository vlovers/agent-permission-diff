# AI engineering contract

Read [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and the current [release-readiness audit](docs/release-readiness-v0.4.md) before working. This document guides Codex and other agents; [CLAUDE.md](CLAUDE.md) adds Claude Code pointers.

## Non-negotiable boundaries

RuleWitness statically analyzes a **limited** set of configured agent permission rules. It is not runtime authorization, a sandbox, or proof that a command will execute. Preserve `complete: false`, uncertainty/fail-closed behavior, report schema/version contracts, and exit-code semantics (including uncertainty exit 3). Experimental Codex configured-posture inventory must never be described as effective permission evaluation.

Never execute analyzed settings, hooks, commands, or repository code; fetch untrusted revisions; use live credentials; or modify Git state during analysis. Observe bounded parsing, safe Git object reading, and read-only review workflows. Do not suppress unsupported results to obtain passing tests. Preserve separate Claude and Codex capability boundaries.

## Workflow

1. Discover: inspect current code, tests, open issues/PRs, docs and baseline branch.
2. Plan: record objective, acceptance criteria, compatible outputs/exit codes, in/out of scope, and risks.
3. Implement in a dedicated branch/worktree; preserve unrelated changes. Parallel agents must own separate files/interfaces.
4. Verify actual commands; run independent matcher-oracle and consumer tests when semantics change.
5. Obtain independent review of real diff and acceptance criteria, focused on false negatives, unsafe evaluation, schema drift and supply-chain/CI risk.
6. Explain unsupported behavior and limitations; use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
7. Handoff with exact SHA, commands and results, review findings, blockers and next step.

## Checks

Node.js 24; install with `npm ci --ignore-scripts --no-audit --no-fund`.

```sh
npm run typecheck
npm test
npm run build
npm run test:package
npm run format:check
npm pack --dry-run
```

These are documented commands, not proof that they ran. Keep package tests in disposable isolated Git/consumer fixtures with lifecycle scripts disabled. For semantic changes verify independent policy oracle regression coverage, JSON schema and exit-code invariants. For experimental Codex actions inspect read-only consumer test evidence and fail-closed behavior. Never treat a successful CI run as real Claude/Codex runtime conformance.

## Quality and release

Follow [Definition of Done](docs/engineering/DEFINITION_OF_DONE.md), [review policy](docs/engineering/REVIEW_POLICY.md), and [release checklist](docs/engineering/RELEASE_CHECKLIST.md). Publishing requires explicit maintainer authorization and independent verification of exact installed npm bytes. Do not create releases, publish npm, force-push, auto-merge or weaken required checks on your own.
