# RuleWitness v0.3.0 — GitHub PR adoption and release checklist

This is a proposed v0.3.0 guide. **v0.3.0 has not been merged or published.**
For currently published npm usage, install `rulewitness@0.2.0`.

## Use the released v0.2.0 in GitHub PRs

See the read-only consumer workflow proposed in
[PR #14](https://github.com/vlovers/rulewitness/pull/14/files).
Once merged, its permanent path will be
`docs/examples/github-pr-workflow.md`.

The published CLI understands:

```sh
rulewitness compare BASE_SHA HEAD_SHA --markdown --fail-on high
```

The future `--pr-markdown` option and
`formatPullRequestMarkdown(report)` are proposed in
[PR #15](https://github.com/vlovers/rulewitness/pull/15).
**Do not use them with npm v0.2.0**. Once a future version containing those
features is published and validated, update the pinned package version and
switch formats separately.

Use exact, locally available Git commit objects. The checkout must include
both event `base.sha` and `head.sha`, and the reviewer must be able to
distinguish a missing object (analysis error 2) from a scoped pass (0).

## Expected scoped CI behavior

| Situation | Gate exit | Interpretation |
| --- | --- | --- |
| Known ASK to ALLOW, high threshold | 1 | Known modeled change meets threshold |
| Deny-masked allow addition | 0 | No detected modeled decision change |
| Unsupported setting or uncertain decision | 3 | Inspected-model uncertainty |
| Missing base commit or invalid Git input | 2 | Analysis error, not success |
| Both snapshots without tracked settings | 0 | Empty supported model; never a full security pass |

The first five rows describe the intended test matrix; the disposable-Git
regression suite is proposed in [PR #16](https://github.com/vlovers/rulewitness/pull/16).
These checks do **not** demonstrate a complete runtime permission model.

## Fork PR acceptance test (not yet completed)

A true fork-based GitHub Actions consumer run remains outstanding.
Before recommending the workflow as fork-compatible:

1. Open a disposable fork PR against a test repository, using read-only
   `pull_request` permissions and a trusted published analyzer.
2. Verify that the base and head objects match the exact event SHAs.
3. If either object is unavailable, verify the job fails rather than
   silently using moving branches or a synthetic merge commit.
4. Verify escalation (exit 1), uncertainty (exit 3) and malformed/missing
   input (exit 2) each fail the gate without running contributor scripts.
5. Confirm the job summary is produced after gate failures and no PR write
   permissions, secrets or elevated triggers were introduced.

Do not present the current documentation-only workflow example as having
passed this test. Fork reachability depends on checkout/fetch semantics.

## v0.3.0 release readiness

- [x] Audit and roadmap proposed in draft [PR #13](https://github.com/vlovers/rulewitness/pull/13)
- [x] GitHub workflow example proposed in draft [PR #14](https://github.com/vlovers/rulewitness/pull/14)
- [x] Reviewer Markdown proposed in draft [PR #15](https://github.com/vlovers/rulewitness/pull/15)
- [x] Disposable Git consumer tests proposed in draft [PR #16](https://github.com/vlovers/rulewitness/pull/16)
- [ ] Review and integrate the individual PRs in an approved order
- [ ] Verify combined-branch integration, including new `--pr-markdown`
- [ ] Verify exact-SHA behavior in a real same-repository PR and fork PR
- [ ] Confirm hostile Markdown inputs remain inert in GitHub rendering
- [ ] Run `npm ci --ignore-scripts --no-audit --no-fund`
- [ ] Run typecheck, source tests, build, installed-package tests and formatting
- [ ] Review `npm pack --dry-run` contents and separate consumer declarations
- [ ] Verify published v0.2.0 docs remain accurate until release
- [ ] Obtain explicit maintainer approval for merge, version change, tag and release

No `npm publish`, GitHub Release, merge or tag is authorized by this guide.

## Security boundaries

RuleWitness analyzes only its documented configured-rule subset; a reported
`ALLOW` does not authorize executing a command. Settings may contain
sensitive rules and should not be posted to a public PR comment without
review. No analyzed command should be executed. Do not use
`pull_request_target` to check out and execute contributor content.

See [Claude Code permissions](https://code.claude.com/docs/en/permissions)
and [settings](https://code.claude.com/docs/en/settings).
