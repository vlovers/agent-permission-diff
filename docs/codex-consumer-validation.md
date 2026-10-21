# Validate the Codex PR workflow in an external repository

**Status:** independent real consumer `pull_request` runs **verified 2026-10-22** for scenarios A/B/C in [vlovers/rulewitness-consumer-e2e](https://github.com/vlovers/rulewitness-consumer-e2e). A real external fork PR has now passed in GitHub Actions; naturally missing Git objects remain untested, while an injected missing-object preflight was verified. The published-package Git-fixture E2E inside RuleWitness is separate ([PR #61](https://github.com/vlovers/rulewitness/pull/61)). None of these tests establish live Codex authorization.

## Safe disposable consumer test

Use a new **public, disposable** repository under your own account (or another repository whose maintainers approve test-only workflow changes). Do not use a repository with production credentials, workflows that execute PR code, or secrets. Enable Actions and allow ordinary pull requests. The maintainer must perform the repository creation: RuleWitness does not create or administer consumer repositories.

On the default branch:

1. Copy the exact pinned [Codex posture workflow](../examples/github-actions/codex-posture-pr.yml) to `.github/workflows/codex-posture-pr.yml`. Do not alter the `pull_request` trigger, read-only permissions or installation flags.
2. Commit this _recognized_ baseline `.codex/config.toml`:

   ```toml
   approval_policy = "on-request"
   sandbox_mode = "read-only"
   ```

3. Open **three independent PRs** from the baseline (rather than stacking them). Preserve each Actions run URL, the base/head commit hashes and the job exit code:

   | PR                        | Change to `.codex/config.toml`                                                     | Expected behavior                                                                 |
   | ------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
   | A — recognized transition | Set `sandbox_mode = "workspace-write"`                                             | Review flags a configured change; job fails intentionally                         |
   | B — unsupported input     | Keep the baseline fields and append `[profiles.test]` followed by `model = "test"` | Unresolved/unknown review; job fails intentionally                                |
   | C — unrelated file        | Leave `.codex/config.toml` unchanged, edit a README                                | No recognized config change; job passes **within the tracked posture model only** |

4. Confirm the workflow reports **runtime permission verification not performed** for every case. Inspect `GITHUB_STEP_SUMMARY` for the direction, number of recognized changes and uncertainty. A failed A/B job is the intended conservative outcome, not an Actions infrastructure failure.
5. For a fork PR, repeat C using an untrusted fork only if repository policy permits it. Check the run uses `pull_request`, read-only `contents: read`, and exposes no secrets. Do not use `pull_request_target`.
6. Verify missing/unavailable commit objects fail rather than getting treated as unchanged; this is a distinct environment failure test, not a permission evaluation.

**Important:** The workflow installs `rulewitness@0.4.0-rc.2` and runs the published CLI against two exact Git commits. It does **not** run the Codex agent, execute commands from `.codex/config.toml`, resolve project trust, consult managed or user settings, or establish effective sandbox/network/approval behavior. The example is experimental and does not replace the stable Claude-specific PR gate.

## Recorded real consumer PR evidence (2026-10-22)

Source repository: [vlovers/rulewitness-consumer-e2e](https://github.com/vlovers/rulewitness-consumer-e2e), public disposable repository without secrets or workflows executing PR code. Base SHA for all three PRs: `2034ac81a8bcc9c6fa11d0b2e9f012e04f05a989`. Workflow: exact copy of [experimental Codex posture review](../examples/github-actions/codex-posture-pr.yml), source blob `6e38b2f5d4bd1ee6dead287852344dde6fc16335`, installed npm `rulewitness@0.4.0-rc.2` with `--ignore-scripts`. GitHub Actions used Node 24 and Git 2.55.0.

| Scenario                      | Consumer PR                                                      | Exact head SHA                             | GitHub Actions run                                                                          | Observed comparison exit | Conclusion                       |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------- |
| A — recognized sandbox change | [#1](https://github.com/vlovers/rulewitness-consumer-e2e/pull/1) | `21c2d1947640127c39694cadeba53d7cac810469` | [39686038627](https://github.com/vlovers/rulewitness-consumer-e2e/actions/runs/39686038627) | `1`                      | Expected gate failure            |
| B — unsupported TOML profile  | [#2](https://github.com/vlovers/rulewitness-consumer-e2e/pull/2) | `85a8ba031ab3e783a74b03a9e488bba99abab51f` | [39686040507](https://github.com/vlovers/rulewitness-consumer-e2e/actions/runs/39686040507) | `3`                      | Expected fail-closed uncertainty |
| C — unrelated Markdown change | [#3](https://github.com/vlovers/rulewitness-consumer-e2e/pull/3) | `34f44beae1a44a6fdb2466331fc0070f577fb31f` | [39686046844](https://github.com/vlovers/rulewitness-consumer-e2e/actions/runs/39686046844) | `0`                      | Expected successful gate         |

All three events were real GitHub `pull_request` runs, checked out an inert generated merge commit, installed the immutable pinned prerelease successfully, and reached the exact-Git comparison step. Log inspection confirmed the exit codes. The workflow writes an Actions summary explicitly stating that runtime permission verification was **not performed**, and configuration precedence/trust/ambient settings were **not established**. Summary contents are specified by the pinned workflow; the Actions job-summary UI itself was not independently extracted for this audit. GitHub Release tag and published tarball contents are not changed by this documentation.

**Not tested here:** fork-originated PR, missing/unavailable base/head Git objects on the GitHub runner, npm package digest/provenance, Codex runtime decisions, user/managed settings precedence, and Windows. Do not infer success for these from the A/B/C tests.

### Missing-object negative control — hosted GitHub Actions

On 2026-10-22, [consumer PR #4](https://github.com/vlovers/rulewitness-consumer-e2e/pull/4), head `797f49d3a8bf0bab8e276fdb0d4feea5e0bfd295`, exercised the same `git cat-file -e "${BASE_SHA}^{commit}"` preflight used by the pinned example, with a deliberately unavailable all-zero base SHA. The [negative-control run 39687221024](https://github.com/vlovers/rulewitness-consumer-e2e/actions/runs/39687221024) passed by confirming the missing base is rejected before invoking RuleWitness, and that the real PR head is present. In parallel the [original consumer workflow run 39687220904](https://github.com/vlovers/rulewitness-consumer-e2e/actions/runs/39687220904) passed on unchanged tracked Codex config.

This is an **injected missing-object preflight check**, not proof of behavior under naturally incomplete checkout/fork history. A fork-originated PR remains untested. Neither workflow executes PR scripts or verifies Codex runtime permissions.

### Real fork-originated PR evidence

On 2026-10-22, [consumer PR #5](https://github.com/vlovers/rulewitness-consumer-e2e/pull/5) originated from `mishakogyt/rulewitness-consumer-e2e` branch `mishakogyt-patch-1`, changing only `README.md` (one addition, one deletion). Base SHA: `ecd7d6f8f8a1130798a91248971c422c1a6e69f3`; head SHA: `6b5d7622eafd75201146224b60fb46119df180cf`. The [first-attempt workflow run 39688355860](https://github.com/vlovers/rulewitness-consumer-e2e/actions/runs/39688355860), `pull_request` event, completed **success**. Job logs explicitly show `GITHUB_TOKEN` `Contents: read`, checkout of `refs/remotes/pull/5/merge`, Node 24 setup, and an `npm install --global --ignore-scripts --no-audit --no-fund rulewitness@0.4.0-rc.2`; the compare step succeeded (exit 0). The separate missing-object job was skipped as designed for this branch. The workflow never executes fork-supplied commands or uses `pull_request_target`. No runtime authorization/precedence or actual Codex sandbox behavior was tested; naturally missing objects remain unverified.

## Evidence required before claiming real consumer validation

Record the tested repository URL, source workflow SHA, Node and Git versions, exact npm version/digest if available, run URLs, commit hashes, outcome, and whether the fork check was actually exercised. Check the source Actions logs, not only badges. Leave any unexecuted row marked **not tested**. Avoid publishing secrets or private configuration in the evidence.

After collecting evidence, update [GitHub Actions integration](github-actions-integration.md) and [v0.4 release readiness](release-readiness-v0.4.md); only then may documentation say the consumer template was tested on a real PR. Avoid promoting `0.4.0` to stable solely because these tests pass.
