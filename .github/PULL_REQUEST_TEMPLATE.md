## Purpose and scope
- Linked issue:
- Acceptance criteria:
- Changes made:
- Out of scope:

## Project-specific checks
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:package`, `npm run format:check`, `npm pack --dry-run` (record any not applicable and why).
- [ ] If matcher/provider semantics changed, update `test/independent-witness.test.ts` and document unknown/conformance boundaries.
- [ ] Confirm no analyzed permission command or hook was executed. Packaging checks may run the repository's documented build/prepack step; do not execute lifecycle scripts from analyzed third-party packages. No release/publish was triggered.

## Verification evidence
Record commands and results (do not check a box for an unrun command).
- [ ] Formatting / lint
- [ ] Typecheck (if applicable)
- [ ] Unit / integration tests
- [ ] Build (if applicable)
- [ ] Smoke / end-to-end tests (if applicable)
- [ ] Negative / failure-path regression tests (if applicable)

CI run links and known failures:

## Risk, documentation and release
- Security / authorization / secrets / data impact:
- Documentation and migration changes:
- Rollback or recovery plan (if applicable):
- Unresolved risks / blockers:


## RuleWitness semantic and package safety gates
- [ ] If matcher/provider semantics changed, independent oracle regression updated (`test/independent-witness.test.ts`); unknown/fail-closed behavior and exit code `3` covered.
- [ ] Documented Node.js 24 checks recorded with actual outcomes: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:package`, `npm run format:check`, `npm pack --dry-run` (N/A explained).
- [ ] Package tests run in isolated consumer fixtures; analyzed third-party lifecycle scripts/hooks/commands were not executed.
- [ ] No npm publish or release triggered; separate maintainer authorization required.

## Merge gate
- [ ] Required checks passed
- [ ] Independent review obtained (not author self-review)
- [ ] Blocking findings resolved

Do not merge while any required gate is missing.
