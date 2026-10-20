# RuleWitness v0.3.0 PR adoption

RuleWitness v0.3.0 is published on [npm](https://www.npmjs.com/package/rulewitness/v/0.3.0).
This guide documents the released PR Markdown output and the validated integration evidence. RuleWitness analyzes a **bounded subset of Claude Code project permissions**, not runtime authorization for Claude Code or any other agent.

## Install and run

Requires Node.js 24 and Git 2.47+.

```sh
npm install --save-dev rulewitness@0.3.0
npx --no-install rulewitness compare BASE_SHA HEAD_SHA --pr-markdown --fail-on high
```

Use exact available commit SHAs. A missing object is an analysis error, not permission to fall back to a branch tip. See the [read-only workflow example](examples/github-pr-workflow.md) before configuring GitHub Actions. It installs the published CLI independently of pull-request dependencies and must never run untrusted PR scripts.

## Exit statuses

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | Scoped pass within the modeled configuration rules     |
| 1    | Known change exceeds the configured severity threshold |
| 2    | Analysis or input failure                              |
| 3    | Inspected-model uncertainty                            |

Treat all nonzero exits as failing CI, but distinguish proven changes from uncertainty and analysis failures. Even code 0 does **not** establish safe runtime authorization. Every machine-readable report states `complete: false`.

## Integration evidence and limits

- Same-repository cases: [#21](https://github.com/vlovers/rulewitness/pull/21), [#22](https://github.com/vlovers/rulewitness/pull/22), [#23](https://github.com/vlovers/rulewitness/pull/23).
- External fork: [#26](https://github.com/vlovers/rulewitness/pull/26) exercised checkout, analyzer comparison and job summary. This verifies that scenario, **not universal fork compatibility**.
- [Fork E2E validation plan](fork-pr-e2e.md) documents the additional positive, uncertainty, and escalation cases. Never claim untested cases passed.

Permission settings and witness strings can be sensitive. Review whether publishing the report to a public PR Job Summary is appropriate; the example explains how to omit summary publication.

## Before adopting

1. Confirm the exact version and install from a trusted source; do not run scripts from untrusted changes.
2. Keep the job on `pull_request` with read-only `contents: read`, not `pull_request_target` with checked-out contributor code.
3. Verify both event commit objects and retain failures when either is absent.
4. Review the reported scope and any unsupported/uncertain findings rather than treating a successful exit as a security guarantee.

See [README](../README.md), [security policy](../SECURITY.md), and the [v0.3.0 release](https://github.com/vlovers/rulewitness/releases/tag/v0.3.0).
