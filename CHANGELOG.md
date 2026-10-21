# Changelog

All notable changes are documented here. Entries marked **Unreleased** describe repository code, not a published npm version.

## 0.4.0-rc.2 — release candidate (not published)

### Claude Code review and developer experience

- Added explicit session-context evaluation, permission-source provenance inventory and source-aware conservative evaluation; these opt-in TypeScript APIs do not establish live authorization.
- Hardened project trust, unsupported permission-mode and precedence coverage, with regression tests for `UNKNOWN` and secret-safe diagnostics.
- Hardened fork-compatible GitHub PR Actions reporting, preserving distinct threshold (`1`), analysis error (`2`) and uncertainty (`3`) exit outcomes.

### Experimental Codex configured posture

- Added opt-in Codex posture inspection/review APIs and `codex-posture` / `codex-review` commands comparing exact local Git revisions.
- Replaced the restrictive handwritten TOML syntax parser with pinned `smol-toml`; unmodeled settings still force conservative uncertainty.
- Added tracked Git blob safety checks and experimental configured sandbox, approval and workspace flags. **Not effective Codex permissions**, with `runtimeVerified: false` and `runtimePermissionDiff: false`.
- Extended disposable Git and installed-package tests; documented native trust, managed/user settings, profile and runtime limitations.

### Release preparation

- The v0.4.0-rc.1 version has already been used. This release candidate uses the separate v0.4.0-rc.2 version, pending registry verification and explicit maintainer authorization.
- Publishing requires a matching lockfile, green CI, exact package inspection and a separate explicit GitHub Release decision.

## 0.4.0-rc.1 — published 2026-10-20

### Internal architecture

- Added an internal, bounded provider comparison contract with deterministic candidate ordering, strict decisions, uncertainty preservation, and cross-snapshot replay.
- Added an internal Claude Code adapter that reuses the existing evaluator; it does not replace the production comparison report.
- Added read-only provider-marker discovery and exact-commit Git snapshots. Codex can be _detected_, but its permissions are **not** evaluated.
- Consolidated shared Git subprocess hardening and tree-object validation for Claude and Codex marker discovery.

### Security and verification

- Reject unsafe Claude and Codex Git objects during provider snapshots, including symlinks and gitlinks.
- Added Git-boundary regressions for dirty worktrees, poisoned Git environment, missing revisions, and non-regular tree entries.
- Added synthetic tests for unstable or malformed provider decisions, candidate floods, and resource limits.
- Extended installed-package smoke tests for exact tarball contents and private module exports.
- Added PR consumer regressions and provider architecture/research documentation.

### Compatibility and limitations

- Published public CLI and TypeScript API still target the documented **Claude Code subset only**.
- JSON schema v1, default CLI behavior, and severity/exit gate semantics remain unchanged.
- These changes do **not** demonstrate parity with Claude Code's complete runtime authorization, or native Codex conformance.
- The `v0.4.0-rc.1` GitHub Release was published on 2026-10-20. Its original RC scope predates the later Unreleased Codex posture and session-context changes.

## 0.3.0

- Published reviewer-oriented Markdown presentation while preserving the narrow Claude Code permission model.
- Refer to [v0.3 documentation](README.md), [v0.3 roadmap](docs/roadmap-v0.3.md), and existing GitHub release notes for the historical release.
