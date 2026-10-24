# Issue intake and evidence-based triage

This is the maintainer procedure for public RuleWitness work. It does not
authorize a release, certify a runtime permission model, or override
[SECURITY.md](../SECURITY.md) and the project's review policy.

## Route incoming reports

- **Bug report:** a reproducible discrepancy between documented RuleWitness
  behavior and observed output. Request a sanitized fixture, exact package
  version or SHA, Node/Git versions, exit code, and `complete` / uncertainty
  evidence where relevant. A modeled `ALLOW` is **not** runtime authorization.
- **Feature request:** a bounded user-facing change with documented supported
  inputs, unknowns, acceptance criteria and compatibility impact.
- **Engineering task:** maintenance, migration, verification, dependency or
  release work; identify a concrete artifact and evidence of completion.
- **Potential vulnerability:** do **not** request details in a public issue.
  Direct the reporter to [private reporting instructions](../SECURITY.md).
  If private reporting is unavailable, a minimal public request for a
  private contact must contain no exploit, credentials or private settings.

The issue chooser links to the security policy, not directly to a potentially
disabled GitHub private-reporting endpoint. Maintainers must verify that
private vulnerability reporting is enabled before claiming the endpoint works.

## Verify and prioritize

1. Inspect related open and closed Issues, PRs, release notes and test evidence
   before creating or closing a tracking item. Link duplicates to a canonical
   item with the differing acceptance criteria; do not silently discard them.
2. Confirm the issue is reproducible or mark the missing evidence. Never run
   submitted hooks, agent commands, private configuration or untrusted scripts.
3. Distinguish **implemented**, **tested**, **independently reviewed**,
   **merged**, and **published**. Green CI is not proof of provider runtime
   conformance or package publication.
4. Prioritize **P0** for verified security/data-loss issues or broken
   release/consumer safety; **P1** for reproducible regressions or blocking
   compatibility failures; **P2** for improvements and nonblocking cleanup.
   Apply only labels that actually exist in GitHub; do not imply that these
   priority labels are provisioned by this document.
5. Record an owner, acceptance criteria, affected version, blockers and the
   exact checks needed. Keep independent review separate from author testing.

## Closing or deferring

Close a bug or task only after checking its original acceptance criteria,
linking the implementing commit/PR and the exact CI/consumer evidence, and
recording remaining limitations. A passing test on an older SHA is not evidence
for a changed branch. Keep unresolved safety or runtime-conformance claims
open; link follow-up work rather than equating merged documentation with
product completion.

For releases, additionally require an immutable artifact, installed npm
consumer verification and explicit maintainer authorization. Issue triage
does not grant permission to merge, publish, delete data or change secrets.
