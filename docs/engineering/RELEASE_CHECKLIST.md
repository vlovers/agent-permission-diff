# RuleWitness release gates

Use [current v0.4 release-readiness audit](../release-readiness-v0.4.md), current README and actual GitHub workflows as primary version-specific evidence. This checklist is a generic gate, not permission to publish or a claim that the latest prerelease is released.

## Pre-release

- [ ] Check live open PR/issues, vulnerabilities, latest main, candidate SHA, registry versions and dist-tags.
- [ ] Confirm package.json, lockfile, changelog and intended immutable tag/version agree.
- [ ] Review supported Claude rules versus experimental Codex posture scope; retain explicit unknowns, exit codes, report v1, and `complete: false`.
- [ ] Run clean Node 24 install, typecheck, unit tests, build, package smoke, formatting, Git-boundary tests on exact candidate SHA.
- [ ] Inspect actual npm pack contents; install packed tarball in a clean external consumer with scripts disabled. Verify CLI aliases, library exports/declarations, reports and exit 0/1/2/3.
- [ ] Verify isolated read-only consumer PR runs and fork safety for the **candidate version**, not a different existing published version.
- [ ] Review workflow permissions, SHA-pinned actions, registry OIDC/provenance, tag ancestry and postpublish verification.
- [ ] Independently review critical semantics, regressions, provider docs and residual compatibility/security limits.
- [ ] Obtain explicit maintainer approval before release/tag/publish.

## Post-release

- [ ] Verify npm registry version, dist-tags and provenance independently.
- [ ] Install **actual registry package** into an isolated consumer and test CLI/API, no unsafe script execution.
- [ ] Confirm immutable GitHub release/tag, commit SHA, artifact identity and release notes match.
- [ ] Document remaining unverified real-runtime behavior and independent validation references.

If any gate is pending, state **not approved**; do not treat a green source CI or an older published package as approval.
