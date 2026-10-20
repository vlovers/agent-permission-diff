# v0.4 release readiness audit

Reviewed: 2026-10-21. This document records the status of source in `main`, not a published npm v0.4 release. The package version in `package.json` remains `0.3.0`.

## Implementation status

| Area                                      | Repository status                               | Release implication                                 |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Claude Code CLI and public TypeScript API | Existing `scan`, `compare`, `test`, schema v1   | Must keep compatibility and exact output checks     |
| Internal provider comparison              | Implemented, bounded, synthetic replay-tested   | Not an end-user permission engine                   |
| Claude model bridge                       | Internal, tested against the existing evaluator | No runtime-Claude conformance implied               |
| Provider detection                        | Root-level Claude and Codex marker inventory    | Presence of a marker is not effective authorization |
| Exact-commit snapshots                    | Internal read-only Git implementation           | Reject symlinks/gitlinks; no network/checkout       |
| Codex semantics                           | **Not implemented**                             | No `--provider codex` advertisement or report       |
| npm release                               | Not prepared or authorized                      | Do not tag or publish until every gate below passes |

## Release gates (must all be checked at release commit)

- [ ] Review the actual changes and scope against v0.3.0 and document all supported/unsupported cases.
- [ ] Verify the `main` merge commit and required GitHub Actions checks are green, not canceled or stale.
- [ ] Run Node.js 24 `npm ci --ignore-scripts --no-audit --no-fund`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:package`, `npm run format:check`, and the CLI smoke check.
- [ ] Verify `npm pack --dry-run --json` and **actual offline tarball installation** in a disposable directory; inspect exact packed paths and exclude secrets, tests, local files and transient credentials.
- [ ] Compare installed package's `exports`, `bin`, declaration files, and external consumer behavior with v0.3.0; preserve the `agent-permission-diff` executable alias unless a breaking migration is explicitly approved.
- [ ] Validate report schema v1 golden fixtures, stable ordering, `complete: false`, permission and coverage findings, threshold behavior and CLI exits 0/1/2/3.
- [ ] Resolve outstanding security findings, release blockers and GitHub issues; test Git safety boundaries and confirm no analyzed commands/hooks execute.
- [ ] Update README for the shipped scope, CHANGELOG for verified changes, supported platforms and migration notes.
- [ ] Only after the final scope is approved, bump both `package.json` and lockfile consistently and verify the version does not already exist on npm.
- [ ] Review `.github/workflows/npm-publish.yml` with current permissions, immutable action pins, OIDC trusted publishing, release-tag/version equality and main ancestry.
- [ ] Validate the eventual tagged commit, publish workflow and npm provenance after a deliberate GitHub Release; never publish from this audit PR.

## Explicit blockers before v0.4.0

1. The v0.4 scope and version bump have not been approved or finalized. This audit intentionally leaves version `0.3.0`.
2. Codex detection is _not_ provider support; there is no pinned CLI conformance suite for precedence, trust, ambient policy or sandbox rules.
3. The internal model comparator does not replace production Claude report evidence, completeness or gating.
4. Full native Claude and Windows conformance remain outside the tested scope.
5. A **fresh** end-to-end release candidate run, package inspection and explicit maintainer release decision have not happened.

## Release workflow facts

The checked-in `.github/workflows/npm-publish.yml` is triggered by **GitHub Release published**, not by merging a PR. It checks the tag against package version, validates ancestry and runs typecheck, tests, build, installed-package smoke, formatting, CLI smoke and dry-run pack before npm OIDC publication. This is a description of the workflow source, **not** evidence that an eventual v0.4 run will pass.

Existing public CLI/package users should continue following the pinned v0.3.0 installation instructions until an actual v0.4 npm publication has been verified.
