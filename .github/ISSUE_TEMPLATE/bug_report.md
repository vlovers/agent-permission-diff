---
name: Bug report
about: Report a reproducible, non-sensitive RuleWitness defect
title: "bug: "
---

## Safety and disclosure

**Do not post vulnerabilities, exploits, secrets, private agent settings, or unredacted permission rules here.** Follow the [security policy](https://github.com/vlovers/rulewitness/blob/main/SECURITY.md) for private disclosure. Use sanitized fixtures; do not run the analyzer on sensitive data just to reproduce a report.

## Observed versus expected behavior

What did RuleWitness report, and what should its **documented configured-rule model** report? Do not infer actual Claude Code or Codex runtime authorization from a modeled decision.

## Minimal reproduction

1. Tested version or exact commit:
2. Sanitized input or minimal fixture:
3. Command and flags (omit credentials and private paths):
4. Expected result:
5. Actual result:

## Evidence and environment

- Node.js and Git versions, operating system:
- CLI exit code (0, 1, 2 or 3), stdout/stderr after redaction:
- JSON `schemaVersion`, `complete`, and relevant uncertainty indicators, if applicable:
- Redacted CI run or test link:
- Does this reproduce with a clean checkout and a locally installed package?

## Acceptance criteria

- [ ] A regression test or independently reproducible sanitized fixture demonstrates the issue.
- [ ] The fix preserves supported-versus-unknown distinctions, `complete: false`, and exit-code precedence (including uncertainty exit 3).
- [ ] JSON v1, installed CLI and TypeScript API compatibility are checked where affected.
- [ ] Relevant checks and exact CI evidence are recorded, including any untested scenarios.
- [ ] Independent review addresses blocking findings before maintainer acceptance.
