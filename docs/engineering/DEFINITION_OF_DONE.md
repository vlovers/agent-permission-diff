# Definition of Done

A change is **implemented** when its agreed code/docs and acceptance criteria exist, **verified** when relevant checks and independent review have evidence, **accepted** when the maintainer confirms requirements, and **released** only after publishing and external verification. None of these states are interchangeable.

## Required for code changes

- Purpose, scoped behavior, compatibility boundaries and explicit non-goals documented.
- Supported and unsupported agent semantics remain evidence-based; no runtime enforcement claims.
- Preserve report schema/version compatibility, exit codes (including uncertainty precedence), `complete: false` and fail-closed behavior or explicitly document, review and test a versioned breaking change.
- Regression tests exercise edge cases, malformed/untrusted Git/config inputs, uncertainty, and no-execution guarantees where applicable.
- Matcher changes extend the **independent policy oracle**, not just implementation-sharing tests.
- Exact commands and environment evidence reported: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:package`, `npm run format:check`, and `npm pack --dry-run` when relevant. No invented passing results.
- Consumer/CI/action changes include isolated published/packed package verification and realistic read-only fork safety where applicable.
- Independent reviewer checks original diff, test value, security, false negatives and backwards compatibility. Resolve blocking findings.
- README and relevant compatibility/release docs describe verified behavior, not proposals.

Docs-only PRs may justify runtime checks as N/A; check relative links and factual command references. A green CI result does not prove runtime conformance or release approval.

For publication follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and obtain separate authorization.
