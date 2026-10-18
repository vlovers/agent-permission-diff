# RuleWitness v0.3.0 PR adoption checklist

This is a proposed guide. **v0.3.0 is not published.** The currently published npm version is `rulewitness@0.2.0`.

## Published CLI usage

Use `rulewitness compare BASE_SHA HEAD_SHA --markdown --fail-on high` with the
published v0.2.0. A read-only example workflow is proposed in
[PR #14](https://github.com/vlovers/rulewitness/pull/14/files).

The opt-in `--pr-markdown` output is proposed in
[PR #15](https://github.com/vlovers/rulewitness/pull/15). Do not assume it
exists in v0.2.0.

## GitHub PR safety

- Use `pull_request` with read-only `contents` permissions.
- Use the exact event base and head commit SHAs, not branch names.
- Install a fixed, trusted published analyzer, never PR dependencies.
- Do not execute contributor-supplied hooks or scripts.
- Treat missing base objects as analysis errors, never as passes.
- Remember that reports can contain sensitive permission strings.

## Exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Scoped pass, never a full security certification |
| 1 | Confirmed modeled finding meets the chosen threshold |
| 2 | Analysis or Git input failed |
| 3 | Inspected-model uncertainty |

Disposable Git integration scenarios are proposed in
[PR #16](https://github.com/vlovers/rulewitness/pull/16).
These do not validate GitHub Actions behavior for actual fork PRs.

## Release checklist

- [x] Audit and roadmap drafted in PR #13.
- [x] Read-only workflow proposed in PR #14.
- [x] Reviewer Markdown proposed in PR #15.
- [x] Disposable Git tests proposed in PR #16.
- [ ] Review and merge approved PRs.
- [ ] Verify integrated tests and installed package.
- [ ] Validate real same-repository and fork PR checkouts.
- [ ] Confirm reports remain inert when rendered in GitHub.
- [ ] Update the workflow's pinned analyzer only after publishing the new version.
- [ ] Verify package manifest, version, changelog, and npm provenance.
- [ ] Release only once outstanding checks have been resolved.

The existing configured-rule model is deliberately partial.
An `ALLOW` finding never guarantees Claude Code will execute a command.

Official documentation: [permissions](https://code.claude.com/docs/en/permissions)
and [settings](https://code.claude.com/docs/en/settings).
