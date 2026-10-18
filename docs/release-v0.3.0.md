# RuleWitness v0.3.0 release notes

## Scope

Version 0.3.0 improves pull request review for the existing Claude Code rule model.

- Adds the opt-in pr-markdown comparison format.
- Adds a TypeScript formatter for pull request reviews.
- Includes a read-only GitHub Actions example.
- Includes disposable Git consumer regression tests.
- Updates documentation and release guidance.

No additional provider semantics are claimed.

## Validation

- Verify full CI and installed-package tests.
- Verify exported TypeScript declarations.
- Test real GitHub same-repository and fork pull requests.
- Review the npm package contents and provenance.
- Confirm registry availability before publication.

Missing Git objects must fail conservatively.

No report establishes Claude Code runtime authorization.
