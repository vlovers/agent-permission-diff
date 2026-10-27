## Purpose and scope

- Linked issue:
- Acceptance criteria:
- Changes made:
- Out of scope:

## Verification evidence

Record exact commands, results, and CI links. An unchecked or unrun command is not passing; explain N/A.

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:package`
- [ ] `npm run format:check`
- [ ] `npm pack --dry-run`
- [ ] Relevant negative/failure-path regression tests

CI run links, exact head SHA, and known failures:

## RuleWitness-specific safety

- [ ] Matcher/provider changes include an independent oracle regression in `test/independent-witness.test.ts`, with unknown/fail-closed behavior and exit code `3` covered where relevant.
- [ ] Package-consumer checks use isolated fixtures. No analyzed third-party hooks, permission commands, or lifecycle scripts were executed.
- [ ] No npm publish or release was triggered; publication requires separate maintainer authorization.

See [Definition of Done](../docs/engineering/DEFINITION_OF_DONE.md), [independent review policy](../docs/engineering/REVIEW_POLICY.md), and [release checklist](../docs/engineering/RELEASE_CHECKLIST.md).

## Risk, documentation, and release

- Security / authorization / secrets / data impact:
- Documentation and compatibility changes:
- Rollback or recovery plan (if applicable):
- Unresolved risks / blockers:

## Merge gate

- [ ] Required checks passed on the recorded head SHA
- [ ] Independent review obtained (not author self-review)
- [ ] Blocking findings resolved

Do not merge while any required gate is missing.
