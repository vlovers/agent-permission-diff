# Read-only GitHub pull-request permission review

This is a **consumer example**, not a workflow activated in RuleWitness itself.
Copy the YAML below to the target repository's `.github/workflows/rulewitness.yml`.
This example installs a **fixed published version** of RuleWitness rather than executing the untrusted PR's `package.json`, build scripts or workflow content.

The published v0.3.0 release provides `--pr-markdown`. This example remains unverified for fork pull requests.\n\nRequirements: GitHub Actions running on Linux; a GitHub checkout that contains both exact event SHAs; Node.js 24 and Git 2.47+; the trusted published `rulewitness@0.3.0` package. Review and pin newer RuleWitness versions deliberately.

```yaml
name: RuleWitness PR permissions
on:
  pull_request:

permissions:
  contents: read

jobs:
  permission-review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 0
          # Checkout PR content as inert Git data; never run scripts from it.
          ref: ${{ github.event.pull_request.head.sha }}
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - name: Install pinned published analyzer (not PR dependencies)
        run: npm install --global --ignore-scripts --no-audit --no-fund rulewitness@0.3.0
      - name: Verify both exact event commits exist
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        shell: bash
        run: |
          git cat-file -e "${BASE_SHA}^{commit}"
          git cat-file -e "${HEAD_SHA}^{commit}"
      - name: Compare exact PR revisions
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        shell: bash
        run: |
          set +e
          rulewitness compare "$BASE_SHA" "$HEAD_SHA" --pr-markdown --fail-on high > "$RUNNER_TEMP/rulewitness-report.md" 2> "$RUNNER_TEMP/rulewitness-error.txt"
          result=$?
          set -e
          echo "RuleWitness gate exit code: $result"
          exit "$result"
      - name: Publish job summary (even when gate fails)
        if: always()
        shell: bash
        run: |
          if [ -f "$RUNNER_TEMP/rulewitness-report.md" ]; then
            cat "$RUNNER_TEMP/rulewitness-report.md" >> "$GITHUB_STEP_SUMMARY"
          else
            printf '%s\n' '### RuleWitness analysis did not produce a report' 'Check the analyzer step logs and exact Git refs. Exit code 2 is an analysis failure, not a passing scan.' >> "$GITHUB_STEP_SUMMARY"
          fi
```

## Trust and operational notes

- `pull_request` with `contents: read` deliberately avoids write tokens. Do **not** change to `pull_request_target` while checking out an untrusted PR head.
- All configured rule strings and witnesses remain **data**, never commands to run. The only executed analyzer comes from the pinned released npm package. Review the published package's supply chain before adopting.
- `fetch-depth: 0` makes the history available, but cross-repository/fork PRs may have a base SHA not reachable by the head repository's fetched refs. **If the analyzer returns exit 2, do not treat the check as a pass.** The preflight step fails closed when objects are missing. Real fork PR support is not yet verified; never silently replace SHAs with branch names.
- Gate exit codes: 0=scoped pass, 1=known threshold violation, 2=analysis/input failure, 3=inspected-model uncertainty. A gate result cannot certify runtime Claude Code authorization; every report retains `complete: false`.
- The summary includes verbatim permission rules from the repository. If those strings are sensitive, omit the summary publishing step and keep the output in job logs subject to your organization's retention settings.
- This example has not yet been validated by a dedicated GitHub Actions consumer fixture against both same-repo and fork PRs. It should not be described as universally fork-compatible until that validation is completed.
- Manual follow-up: obtain a real PR, check known escalation and uncertainty, verify absent base object produces code 2, and confirm the summary does not hide failures.

See [README](../../README.md) for the supported Claude Code permission subset, assumptions and known exclusions.
