# Contributing

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

Changes to the JSON format should retain `schemaVersion` compatibility or explicitly increment it. Severity changes require a documented transition table and tests. A pull request should describe the problem, resulting behavior, coverage limits, and checks run.

The package suite installs only a locally produced tarball in disposable repositories beneath this project, using offline npm with lifecycle scripts disabled. It verifies compiled behavior and installed imports/declarations without including source tests in the package. See the [release checklist](docs/release-readiness.md) for package contents, reproduction commands and GitHub settings. This project currently has no publishing or deployment automation. Releases and registry publication require a separate maintainer decision.
