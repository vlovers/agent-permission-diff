# RuleWitness v0.4.0-rc.2 — historical prerelease notes

**Status: published on 2026-10-21 as an experimental npm `next` prerelease.** Stable `latest` remained `0.3.0` at the confirmed postpublication verification. This page preserves the original release-candidate scope; later PRs #60–#63 are changes to `main`, not part of the immutable rc.2 tarball. The GitHub Release description was originally drafted before publication and must not be used as evidence of the current registry state.

## Highlights

- Claude Code: source-aware TypeScript APIs, session-context assumptions and conservative coverage diagnostics for unsupported permissions. Existing supported-rule semantics and JSON report schema v1 remain unchanged.
- Codex (experimental): read-only, exact-Git comparison of tracked `.codex/config.toml`, using a standards-compliant TOML parser. `codex-posture` and `codex-review` expose configured sandbox/approval posture observations, **not effective permission changes**.
- Security: Git objects are inspected without checkout or executing referenced commands/hooks; uncertainty is explicit for unsupported configs, trust, ambient settings and runtime context.
- CI/DX: installed-package regression coverage for Codex CLI, fork-compatible Claude PR review summary and clearer release checks.

## Installing the published experimental candidate

```sh
npm install --save-dev rulewitness@0.4.0-rc.2
npx --no-install rulewitness compare HEAD~1 HEAD --json
npx --no-install rulewitness codex-review HEAD~1 HEAD --json
```

The package was independently verified after publication. Re-check npm registry metadata when making any new release decision. Stable Claude workflow examples continue to use `0.3.0`.

## Known limitations

- All Claude `ALLOW` outputs concern the supported, tracked rule model only; not live tool authorization.
- Codex results concern **configured posture**. `runtimePermissionDiff: false` and `runtimeVerified: false` remain invariant.
- Trust, project/user/managed config precedence, Codex profiles, shell/approval behavior and ambient runtime policy are not resolved from Git. Missing or unsupported config must not be interpreted as safe.
- Windows and full runtime agent conformance have not been established.

## Historical prerelease preparation checklist (completed before publication)

1. Before publication, confirm npm registry did **not** already contain `0.4.0-rc.2`; check intended `next` and preserved `latest` tags. This check must **not** be repeated as a publish instruction now that rc.2 exists.
2. Verify `package.json`, `package-lock.json`, `CHANGELOG.md`, proposed tag `v0.4.0-rc.2` and exact release commit.
3. Check CI, permissions review, release-registry preflight, Node 24 typecheck/tests/build/format.
4. Inspect `npm pack --dry-run --json`, actual tarball paths, exports/declarations, both binaries, dependency inclusion and offline consumer installation.
5. Verify the npm OIDC trusted publishing workflow's configured publisher, GitHub tag main ancestry and postpublish registry verification.
6. Obtain maintainer authorization for **tag / GitHub Release / npm publish**. This was a historical checklist; never republish the immutable rc.2 package.

The prerelease used `next`, not `latest`. A **future** release requires a fresh registry check, different version, release-gate audit and separate authorization.
