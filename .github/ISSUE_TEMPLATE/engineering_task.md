---
name: Engineering task
about: Propose a scoped RuleWitness implementation, maintenance or verification task
title: "task: "
---

## Desired outcome

What concrete user or engineering problem does this solve? Link the relevant roadmap item, incident, or prior Issue.

## Current evidence

Link code, source documentation, reproductions, CI runs and related PRs. Distinguish **implemented**, **tested**, **independently reviewed**, **merged** and **published**.

## Scope and non-goals

**In scope:**

**Out of scope:**

## Acceptance criteria

- [ ] Observable behavior or a deliverable can be verified independently.
- [ ] Supported Claude Code rules and experimental Codex posture remain separate from actual runtime authorization; uncertainty and `complete: false` are preserved.
- [ ] CLI exits 0/1/2/3, JSON v1 and public API/package compatibility are addressed when relevant.
- [ ] Tests cover the change with independent evidence (including an installed npm consumer when packaging or CLI behavior changes).
- [ ] No analyzed commands or hooks execute; Git access remains read-only, and credentials/private settings do not enter logs or fixtures.
- [ ] Security, compatibility, rollback and release implications are evaluated.
- [ ] Independent reviewer findings and exact CI results are recorded; publication requires separate authorization.

## Dependencies and risks

- Blocked by:
- Related PRs:
- Migration or rollback:
- Unverified assumptions:

For security vulnerabilities, **do not use this public template**; follow the [security policy](https://github.com/vlovers/rulewitness/blob/main/SECURITY.md).
