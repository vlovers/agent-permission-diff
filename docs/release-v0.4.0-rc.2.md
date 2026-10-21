# RuleWitness v0.4.0-rc.2 — proposed release notes

**Status: candidate only. Not published.** This file is a maintainer review artifact, not a release announcement. Publish only after the exact release commit passes the checks in [release readiness](release-readiness-v0.4.md) and a separate explicit release decision.

## Highlights

- Claude Code: source-aware TypeScript APIs, session-context assumptions and conservative coverage diagnostics for unsupported permissions. Existing supported-rule semantics and JSON report schema v1 remain unchanged.
- Codex (experimental): read-only, exact-Git comparison of tracked `.codex/config.toml`, using a standards-compliant TOML parser. `codex-posture` and `codex-review` expose configured sandbox/approval posture observations, **not effective permission changes**.
- Security: Git objects are inspected without checkout or executing referenced commands/hooks; uncertainty is explicit for unsupported configs, trust, ambient settings and runtime context.
- CI/DX: installed-package regression coverage for Codex CLI, fork-compatible Claude PR review summary and clearer release checks.

## Installing after publication is independently verified

```sh
npm install --save-dev rulewitness@0.4.0-rc.2
npx --no-install rulewitness compare HEAD~1 HEAD --json
npx --no-install rulewitness codex-review HEAD~1 HEAD --json
```

These commands are **not an instruction to install rc.2 before publication**. The published `0.3.0` stable workflow example remains unchanged until an audited release is available.

## Known limitations

- All Claude `ALLOW` outputs concern the supported, tracked rule model only; not live tool authorization.
- Codex results concern **configured posture**. `runtimePermissionDiff: false` and `runtimeVerified: false` remain invariant.
- Trust, project/user/managed config precedence, Codex profiles, shell/approval behavior and ambient runtime policy are not resolved from Git. Missing or unsupported config must not be interpreted as safe.
- Windows and full runtime agent conformance have not been established.

## Maintainer release gate (not yet approved)

1. Confirm npm registry does **not** already contain `0.4.0-rc.2`; confirm desired `next` and preserved `latest` tags.
2. Verify `package.json`, `package-lock.json`, `CHANGELOG.md`, proposed tag `v0.4.0-rc.2` and exact release commit.
3. Check CI, permissions review, release-registry preflight, Node 24 typecheck/tests/build/format.
4. Inspect `npm pack --dry-run --json`, actual tarball paths, exports/declarations, both binaries, dependency inclusion and offline consumer installation.
5. Verify the npm OIDC trusted publishing workflow's configured publisher, GitHub tag main ancestry and postpublish registry verification.
6. Obtain maintainer authorization for **tag / GitHub Release / npm publish**. Do not execute any of these from this PR.

The `next` dist-tag, not `latest`, is intended by the existing prerelease publishing workflow. Verify the actual registry state again before the release.
