# RuleWitness v0.3 PR adoption

This guide describes proposed v0.3 functionality.

Version 0.3.0 is not yet published.

The current npm package is version 0.2.0.

## Existing CLI

```sh
rulewitness compare BASE HEAD --markdown --fail-on high
```

Use exact base and head commit IDs.

The new pr-markdown option is not available in npm 0.2.0.

## Security

- Use read-only GitHub permissions.
- Do not run untrusted pull request scripts.
- Install a trusted published analyzer.
- Treat missing commit objects as analysis errors.
- Treat reports as potentially sensitive.
- Preserve explicit uncertainty.

## Exit status

- 0 means scoped pass.
- 1 means known threshold violation.
- 2 means analysis failure.
- 3 means uncertainty.

A scoped pass is not runtime authorization.

## Remaining release checks

- Verify combined CI.
- Test actual same-repository pull requests.
- Test actual fork pull requests.
- Verify rendered Markdown.
- Validate packaged CLI usage.
- Update release-specific documentation.
- Review and publish the new npm version.

Fork compatibility has not been established.
