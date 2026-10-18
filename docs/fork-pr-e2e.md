# Fork pull request end-to-end validation

This is a reproducible validation plan for the published RuleWitness v0.3.0 CLI and the repository's read-only PR workflow. The external fork [PR #26](https://github.com/vlovers/rulewitness/pull/26) passed the checkout, analyzer comparison, and Job Summary checks. Other fork scenarios remain subject to verification.

## Preparation

1. Use a disposable fork of `vlovers/rulewitness` and a disposable branch.
2. Keep the upstream `main` branch and the upstream workflow unchanged for the duration of the test.
3. Do not grant write permissions, secrets, or use `pull_request_target`.
4. The trusted analyzer must be the published `rulewitness@0.3.0`; do not install PR dependencies.

## Positive case: unchanged permissions

1. In the fork, create a branch with only a harmless documentation change.
2. Open a PR against `vlovers/rulewitness:main`.
3. Verify that `RuleWitness permissions review` runs for the fork PR.
4. Verify that both event commit SHAs are present as Git commit objects and that the comparison succeeds.
5. Confirm the Job Summary includes the report and retains the scope limitation (`complete: false`).

If the checkout or either SHA preflight fails, record the log and mark fork compatibility **not verified**. Never substitute branch names, a merge SHA, or another commit for the exact event base/head.

## Negative case: uncertainty

In the fork branch, add `.claude/settings.json` with:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"]
  }
}
```

Open a new PR against an upstream base without that tracked rule. Expect a non-success gate due to uncertainty (normally exit 3), not a silently passing check. A different outcome needs investigation; do not claim blanket permission-escalation detection.

## Separate known-escalation check

A confirmed `ASK → ALLOW` requires the **base revision already to contain the matching ASK rule**. Do not add such a rule to production `main` just to run a test. Use a disposable upstream test branch with the ASK baseline and a fork PR with the matching ALLOW, then verify exit 1 with `--fail-on high`. The existing same-repository test is tracked in [PR #23](https://github.com/vlovers/rulewitness/pull/23).

## Record evidence

Record the PR URL, Actions run URL, observed base/head SHAs, `Compare exact commits` exit code, Job Summary result, and whether a fork owner approved first-run workflows. Close the test PR without merging. Only mark fork support verified after the workflow actually runs end-to-end on a fork PR.

Do not publish sensitive permission strings in a public report. No analyzed rule is ever authorized to execute a command.
