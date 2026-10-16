# First GitHub release readiness

Baseline: audited commit `52c6ac6f2f78293c15bbc199b70d533430a09bb1`. The baseline has two linear local commits; `git fsck --full` passed. No tracked IDE files or generated build artifacts were present. Unrelated untracked `.idea/` files are excluded from formatting and packaging and are not part of this change.

Intended repository: [vlovers/agent-permission-diff](https://github.com/vlovers/agent-permission-diff). Repository existence, visibility and remote settings could not be verified through the public web fetch. The URL is used as project metadata and for prospective disclosure links; no repository, remote, push, release, deployment or npm publication is created by this preparation.

## Local verification

Use Node.js 24 and Git supporting `--no-lazy-fetch` (documented in 2.47+):

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run test:package
npm run format:check
npm pack --dry-run
```

The source suite has 28 tests. The package suite has seven tests and creates four disposable Git repositories: a supported approval change with merged tracked local settings; realistic unsupported hooks/sandbox/Read settings; a deny-masked grant; and no settings. It exercises compiled `compare` and `scan`, both output formats, exact evidence locations, partial coverage, dirty-worktree/index preservation, exit 0 with findings, and exit 2 with empty stdout on errors. Configured commands are never executed.

It compares npm dry-run and actual tarball manifests, installs the tarball offline with scripts/audit/funding/lockfile generation disabled, runs the installed executable and ESM exports, and compiles a separate TypeScript consumer against installed declarations. The source tree is absent from the installed package. Golden examples are byte-for-byte CLI captures, including fixture commit IDs; they are checked against both the README and files in `docs/examples`.

CI's existing `check` job now runs both suites after building. It has read-only contents permission and no publish credentials or deployment step. CI must run successfully on GitHub after an approved push before it can serve as a required remote check. Local validation is not a claim that remote CI has run.

Local results: **35 passing tests** (28 source + seven installed-package tests), typecheck, build, formatting, whitespace checks, and ordinary `npm pack --dry-run` including its build hook passed. The manifest contains **32 files**. The first ordinary dry-run encountered a sandbox-denied npm cache write; the authorized rerun succeeded. No cache ownership changes or registry operations were performed.

## Package contract

The package remains `agent-permission-diff@0.1.0`, ESM only, Node.js 24, MIT licensed, with no runtime dependencies. The public library export is `dist/index.js` with `dist/index.d.ts`; the bin entrypoint is `dist/cli.js` with a Node shebang. npm installation supplies its executable shim. No npm release is performed.

Included:

- `package.json`, README, MIT LICENSE, CONTRIBUTING and SECURITY.
- Sixteen compiled `.js`/`.d.ts` files for cli, compare, git, glob, index, policy, report and types.
- Research, audit and release documentation plus eight captured human/JSON example reports.

Excluded: `.git`, `.github`, `.idea`, `src`, tests/fixtures, scripts, TypeScript/formatter configuration, lockfile, node_modules, caches, and disposable repositories. The package's development scripts are metadata, not consumer install hooks; no install or telemetry hook exists. `prepack` builds from a source checkout before ordinary packing. Packing with `--ignore-scripts` assumes an explicitly completed build.

`npm pack --dry-run` only describes a package; it does not publish. The smoke suite creates a real temporary tarball solely for local installation and deletes its fixtures afterward. Keep the allowlist and manifest assertions current when adding intended documentation or runtime modules.

## Recommended GitHub settings

These are recommendations to apply manually after explicit authorization, not settings changed by this work.

1. Use `main` as the default branch. Protect it with a ruleset requiring pull requests and the CI `check` status from GitHub Actions. Select the exact status once the first remote run exists. Block force pushes and branch deletion. Require resolved conversations; require an independent approving review when another reviewer is available. Limit administrator bypass.
2. Keep Actions permissions at read-only repository contents; leave permission to create/approve pull requests disabled for the default token. Allow the pinned official actions used here. Do not use `pull_request_target` to run contributor code, attach publishing secrets to pull-request workflows, or add automatic deployment/publication.
3. Enable private vulnerability reporting before public release and verify the reporting form. Assign a maintainer to security notifications. Follow [GitHub's private reporting instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) and [SECURITY](../SECURITY.md).
4. Enable the dependency graph and Dependabot alerts. Keep the checked-in weekly npm/GitHub Actions update configuration. If enabling secret scanning/push protection, review availability and settings on the repository; neither feature is verified enabled here.
5. For the first GitHub release, describe v0.1.0 as an **experimental configured rule-policy comparator**, mark it as a prerelease, and link the supported-semantics table and audit. A GitHub prerelease flag does not change the package version to a SemVer prerelease. Create a version tag only after all checks pass and a maintainer explicitly authorizes publishing the GitHub release. npm publishing is a separate future decision.

See [GitHub branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) for required checks/reviews. Hosting-side settings and private-report availability are not represented by files in this checkout.

## Remaining blockers

- **Public-release operations:** authorization, a successful first remote CI run, enabled/verified private vulnerability reporting, and a responsible security contact/notification owner. These cannot be completed by local preparation alone.
- **Runtime-complete claims:** the [audit's limitations](audit-v0.1.md#unsupported-behavior-and-release-blockers) still apply. Shell normalization, external/runtime sources and other tools remain outside this model; provider version compatibility and native conformance are unverified. Every report retains `complete: false`; `evaluate()` must never authorize execution.
- **Platform claims:** package smoke checks have run on local macOS; CI is configured for Linux but has not run remotely. Windows execution/symlinks are not validated. Do not advertise Windows support before testing it.

The implementation is being prepared for an explicitly limited experimental GitHub prerelease, not a runtime-complete security release. These constraints must remain in the README and release description. An empty finding list or exit 0 is never a security pass.
