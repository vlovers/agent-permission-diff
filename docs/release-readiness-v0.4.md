# RuleWitness v0.4 — release readiness (source audit)

Reviewed: 2026-10-21. **Current main package version: `0.4.0-rc.1`**. GitHub [v0.4.0-rc.1](https://github.com/vlovers/rulewitness/releases/tag/v0.4.0-rc.1) was published on 2026-10-20. Its published npm status must be checked at the registry for a release decision; GitHub Release publication alone does not establish npm propagation. The code merged **after** that tag is `Unreleased` and must never be republished with an already-used version.

## Actual scope and limits

| Area                                  | Current repository status                                                                                   | Release interpretation                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Claude `scan`, `compare`, `test`      | Existing narrow configured-rule model                                                                       | Preserve JSON report v1, exits 0/1/2/3 and `complete: false` |
| TypeScript API                        | Context, source inventory, source-aware evaluation                                                          | Caller-supplied assumptions, not runtime authorization       |
| Codex `codex-posture`, `codex-review` | Experimental exact-Git, standard TOML, bounded configured-posture comparisons                               | **Not** semantic effective-permission comparisons            |
| Git object readers                    | Verify commit IDs, regular blobs, disallow symlinks/gitlinks, read-only runner                              | No checkout/fetch/execution of analyzed commands             |
| GitHub Actions example                | Published **stable v0.3.0** Claude analyzer only                                                            | Do not claim Codex commands work in this installed version   |
| Package                               | New pinned `smol-toml@1.9.1` runtime dependency                                                             | Verify actual offline installation of packed tarball         |
| Release workflow                      | GitHub Release `published` trigger, npm OIDC, tag/version and main-ancestry guard, postpublish verification | No publish on PR merge                                       |

## Required release gates

- [ ] Select a **new unused** release version and separately approve its supported scope. Do not reuse `0.4.0-rc.1`.
- [ ] Check latest `main`, all open issues/PRs, complete GitHub CI, and any unresolved vulnerabilities.
- [ ] Verify `npm view rulewitness versions --json`, `dist-tags` and intended release version against registry (no cache).
- [ ] Confirm `package.json`, lockfile root package, changelog and Git release tag agree.
- [ ] On the **exact proposed release commit**, run Node 24 `npm ci --ignore-scripts --no-audit --no-fund`, `typecheck`, `npm test`, `build`, `test:package`, `format:check` and Git-boundary regressions.
- [ ] Inspect both `npm pack --dry-run --json` and actual tarball contents, installed API, .d.ts, both executable aliases and Codex commands **from that installed tarball**.
- [ ] Review compatibility of Claude v1 evidence, severity, complete flag, exit statuses and stored fixture output.
- [ ] Confirm Codex posture reports `runtimePermissionDiff: false` and `runtimeVerified: false`, and does not silently pass unsupported TOML, unknown sources or missing config.
- [ ] Check docs for no overclaim: user/managed settings, trust, profiles, runtime approvals, real sandbox enforcement and unsupported Codex operations.
- [ ] Review immutable GitHub Action pins, release tag equality, main ancestry, OIDC permissions and postpublish verification.
- [ ] Obtain explicit maintainer decision, then create the tag/GitHub Release; verify npm provenance, installed bytes and dist-tags afterwards.

## Blocking issues

1. Source `main` has unreleased commits while package metadata remains `0.4.0-rc.1`. Any npm publish would collide with the already published candidate and be rejected by the release registry guard.
2. The source code's experimental Codex posture review is **not** effective command authorization, and cannot be called a production Codex permissions provider.
3. The public v0.3.0 Action example cannot run Codex commands. A new npm version and tested integration are prerequisites.
4. Full runtime conformance with Claude Code and Codex, especially ambient policies and Windows, is not established.
5. A tagged-release verification run against the **future** release commit has not occurred.

## Decision

**No publishing from this PR.** Land release-readiness tests and docs without bumping versions, creating tags or changing `latest`/`next`. Only a follow-up explicitly approved release-candidate bump can initiate an end-to-end release process.
