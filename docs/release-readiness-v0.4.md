# RuleWitness v0.4 — release readiness (source audit)

Reviewed: 2026-10-21. **Published prerelease:** `v0.4.0-rc.2` / npm `next` (`rulewitness@0.4.0-rc.2`); **stable `latest`: `0.3.0`**. PR #60 fixed read-only postpublish propagation checks and introduced the experimental Codex consumer workflow. PR #61 verified the published package against isolated exact-Git fixtures in Actions, while PR #63 exercised the consumer shell gate against the pinned published CLI (exit 0/1/3). These changes landed **after** the immutable rc.2 npm package and must not be described as rc.2 tarball contents. [Real consumer PR validation](codex-consumer-validation.md) confirmed A/B/C with exit 1/3/0 in GitHub Actions on 2026-10-22; fork PR and missing-object scenarios remain untested. This is not a stable release approval.

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

- [x] Confirm immutable `0.4.0-rc.2` publication and independent npm registry verification. Do not republish that version; no stable `0.4.0` approval follows.
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

## Remaining blockers for a stable v0.4.0 decision

1. Revalidate registry metadata, package contents, exact proposed stable commit, GitHub CI and all security boundaries before any new stable tag.
2. Codex posture comparison is **not** effective command authorization or production Codex permission analysis; runtime precedence and project trust remain unresolved.
3. Real consumer A/B/C pull-request runs [are recorded](codex-consumer-validation.md); **fork-originated PR**, missing Git objects on the Actions runner, and independent npm integrity/provenance remain unverified.
4. Claude/Codex runtime conformance, external managed/user settings and Windows coverage remain unverified.
5. The next release requires its own package version, changelog, tarball audit, maintainer authorization, and postpublish verification.

## Decision

**No publishing from this documentation PR.** `rc.2` is already published and immutable. Do not create a new tag, GitHub Release, or change npm `latest`/`next` without separate authorization and fresh final checks.
