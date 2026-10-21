# Changelog

All notable changes are documented here. Entries marked **Unreleased** describe repository code, not a published npm version.

## 0.4.0-rc.1 — published prerelease (2026-10-21)

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
- The `v0.4.0-rc.1` GitHub prerelease was published on 2026-10-21 (Kyiv time). The npm publish workflow completed successfully with the `next` dist-tag and provenance. This is **not** the stable v0.4.0 release; install by explicit version and do not infer Codex permission support.

## 0.3.0

- Published reviewer-oriented Markdown presentation while preserving the narrow Claude Code permission model.
- Refer to [v0.3 documentation](README.md), [v0.3 roadmap](docs/roadmap-v0.3.md), and existing GitHub release notes for the historical release.
