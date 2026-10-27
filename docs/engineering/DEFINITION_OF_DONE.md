# Definition of Done — RuleWitness

A change is **implemented** when the agreed scope exists, **verified** when relevant checks and independent review have evidence, **accepted** when the maintainer confirms requirements, and **released** only after publication and external verification. These states are distinct.

## Required evidence

- Acceptance criteria, scope and non-goals are explicit.
- Preserve limited static-analysis claims: not runtime authorization, a sandbox, or proof a command will execute. Preserve `complete: false`, uncertainty/fail-closed behavior, report schema/version and exit-code semantics (including uncertainty exit code 3), unless a reviewed versioned breaking change is intentional.
- Matcher changes extend the independent policy oracle (`test/independent-witness.test.ts`), not only implementation-sharing tests.
- Record actual Node.js 24 checks as relevant: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:package`, `npm run format:check`, `npm pack --dry-run`. State unrun/N/A checks and why.
- Package tests use isolated consumer fixtures; do not execute analyzed rules/hooks/commands or third-party lifecycle scripts from analyzed packages.
- Independent reviewer records identity, reviewed head SHA, findings and disposition. AI review is not authorized GitHub approval. Re-review material changes and resolve blocking findings.
- Docs describe actual supported/unsupported behavior. A green CI run does not prove real Claude/Codex runtime conformance.

Docs-only changes may mark irrelevant runtime tests N/A with a reason; verify changed links and command references. Publishing requires the separate release checklist and explicit maintainer authorization.
