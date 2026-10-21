# Validate the Codex PR workflow in an external repository

**Status:** procedure only; a successful cross-repository pull-request run has not been recorded. The published-package exact-Git E2E inside RuleWitness is separate ([PR #61](https://github.com/vlovers/rulewitness/pull/61)). Never interpret those fixtures as live Codex authorization.

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

## Evidence required before claiming real consumer validation

Record the tested repository URL, source workflow SHA, Node and Git versions, exact npm version/digest if available, run URLs, commit hashes, outcome, and whether the fork check was actually exercised. Check the source Actions logs, not only badges. Leave any unexecuted row marked **not tested**. Avoid publishing secrets or private configuration in the evidence.

After collecting evidence, update [GitHub Actions integration](github-actions-integration.md) and [v0.4 release readiness](release-readiness-v0.4.md); only then may documentation say the consumer template was tested on a real PR. Avoid promoting `0.4.0` to stable solely because these tests pass.
