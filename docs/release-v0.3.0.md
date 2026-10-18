# RuleWitness v0.3.0 release candidate

## Scope

This version improves GitHub pull-request review of the *existing* documented subset of Claude Code configured-rule decisions.

- Opt-in `compare BEFORE AFTER --pr-markdown` with compact known-change and uncertainty sections, evidence, limitations and gate metadata.
- Additive TypeScript export `formatPullRequestMarkdown`.
- Read-only GitHub Actions consumer example using exact event SHAs and a pinned analyzer package.
- Disposable Git consumer tests for known escalation, masked changes, unknown settings, missing base objects, and empty settings snapshots.
- Updated v0.3 adoption guide, audit and roadmap.

There is **no new Claude Code provider-rule support** and no claim of runtime authorization or verified fork PR support. JSON schema v1, existing `--markdown`, and exit-code precedence remain unchanged.

## Release blockers and validation

- Validate merged source and installed-package CI on this candidate.
- Check the candidate tarball and exported TypeScript declarations.
- Validate real same-repository and fork-PR workflow execution before advertising both as verified.
- Ensure `rulewitness@0.3.0` is not yet published before creating a version tag and GitHub release.
- Review the publishing workflow's npm trusted publisher configuration and resulting provenance.

Do not tag or publish based only on documentation CI.
