# Contributing

RuleWitness evolves AgentPermissionDiff in the same repository. Keep the provider model narrow, evidence-based and explicitly experimental. Do not claim runtime guarantees from raw rule matches or passing policy assertions.

Use Node.js 24. Install development dependencies with `npm ci --ignore-scripts --no-audit --no-fund`.

Before submitting a change, run:

```sh
npm run typecheck
npm test
npm run build
npm run test:package
npm run format:check
npm pack --dry-run
```

Use `npm run format` to apply formatting. Keep runtime dependencies minimal. Add meaningful regression tests for semantic changes. Include primary documentation links when expanding provider semantics, and update the supported/unknown boundary in README. Preserve conservative unknowns until behavior is established; do not silently guess defaults or advertise complete runtime coverage.

Never execute analyzed settings, hooks, agent commands, or package scripts. Keep Git access read-only, argv-based, and restricted to configuration data. Tests create isolated fixture repositories beneath this project and remove only those fixtures. Do not use real credentials or machine-specific agent settings in tests.

Changes to the JSON format should retain `schemaVersion` compatibility or explicitly increment it. Severity changes require a documented transition table and tests. A pull request should describe the problem, resulting behavior, coverage limits, and checks run. Use the public bug-report or engineering-task Issue template only for non-sensitive work. Report vulnerabilities through the private channel described in [SECURITY.md](SECURITY.md); never paste private agent configuration, credentials or exploit details into Issues, PRs or logs.

The package suite creates disposable fixture repositories and installs only a locally produced tarball in an independent consumer outside the source repository, using offline npm with lifecycle scripts disabled. It verifies both bins, compiled commands, installed imports/declarations, exits and captured reports without including source tests in the package. See [v0.2 release preparation](docs/release-v0.2.0.md) and [migration](docs/migration-v0.2.md). Regenerate reviewed captures with `RULEWITNESS_UPDATE_EXAMPLES=1 npm run test:package` after building, and inspect every golden/README diff. The repository has a gated npm release workflow; PR checks do not publish packages. Creating a release tag, publishing a GitHub Release, or changing npm dist-tags requires separate maintainer authorization and verification. See [current release readiness](docs/release-readiness-v0.4.md).

Matcher changes should also extend the independent policy oracle in `test/independent-witness.test.ts`: compute expected decisions independently of the production matcher/evaluator and verify generated counterexamples. Keep the distinction between model correctness and installed-provider conformance explicit. The [final review](docs/final-review-v0.2.md) and [maintainer rename plan](docs/github-rename.md) record the candidate boundaries.
