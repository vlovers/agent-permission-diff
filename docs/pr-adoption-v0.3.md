# RuleWitness v0.3.0 PR adoption

RuleWitness v0.3.0 is not published yet.

The published version is `rulewitness@0.2.0`.

## GitHub PR workflow

Use the read-only workflow in `docs/examples/github-pr-workflow.md`.

For the published version:

```sh
rulewitness compare BASE HEAD --markdown --fail-on high
```

The future `--pr-markdown` format is not in npm v0.2.0.

Use exact commit SHAs and a trusted analyzer installation.

Do not execute code from untrusted pull requests.

## CI exit codes

| Exit | Meaning |
| --- | --- |
| 0 | Scoped success |
| 1 | Known threshold violation |
| 2 | Analysis failure |
| 3 | Uncertainty |

Exit 0 is not runtime authorization or security certification.

## Release checks

- [x] Audit: PR #13.
- [x] Workflow example: PR #14.
- [x] PR formatter: PR #15.
- [x] Disposable Git tests: PR #16.
- [ ] Verify the combined main CI.
- [ ] Verify same-repository and fork PR behavior.
- [ ] Review the npm package contents.
- [ ] Verify the new pinned CLI against the workflow.
- [ ] Confirm security limitations remain visible.
- [ ] Publish a new version after validation.

The current workflow has not been verified on a real fork PR.

See the [Claude Code permissions](https://code.claude.com/docs/en/permissions)
and [settings](https://code.claude.com/docs/en/settings) documentation.
