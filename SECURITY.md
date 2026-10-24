# Security policy

RuleWitness is an experimental, offline analyzer of **configured permission rules**, not a sandbox, enforcement mechanism, runtime authorization engine, or complete model of Claude Code or Codex permissions. A modeled `ALLOW`, passing assertion suite, empty finding list, or CI exit 0 does **not** establish that a command is safe or will execute. Every report retains `complete: false`; uncertainty and threshold violations are distinct, and uncertainty exit 3 takes precedence when both apply.

## Private vulnerability reporting

**Do not put exploit details, credentials, private configuration, production URLs or sensitive reports in public Issues or PRs.** Use [GitHub's private vulnerability report](https://github.com/vlovers/rulewitness/security/advisories/new) **if the repository currently offers that form**. Availability is a GitHub setting, not something this document enables or continuously verifies.

If the private form is unavailable, request a private contact through a [minimal public issue](https://github.com/vlovers/rulewitness/issues) **without vulnerability details or sensitive data**, or contact a maintainer privately using a verified channel on their GitHub profile. Wait for a private channel before sending technical details. No response-time commitment or dedicated security email is established.

A useful private report states the affected version/commit, scope and impact, sanitized reproduction, expected versus observed behavior and potential mitigation. Do not test against accounts, repositories or systems you do not own or have permission to assess.

## Analyzer and data boundaries

- Analyzed settings, hooks and agent commands must **never execute**. The analyzer must not fetch Git revisions, read machine credentials, transmit configuration over the network, or modify Git state.
- Git object access is read-only and argv-based. Fixed subprocesses, bounded JSON/TOML/glob processing and exact Git object validation are critical input boundaries; resource limits reduce but cannot eliminate denial-of-service risk.
- Reports can include original supported permission strings and should be treated as potentially sensitive. Unsupported values are represented by fingerprints, **not** confidential redactions; low-entropy values can be guessed.
- Malformed UTF-8, unsupported Git no-lazy-fetch behavior and analysis-limit failures must not be converted into partial success. Unsupported or unknown provider behavior must not silently become `ALLOW`.
- `evaluate()` returns a configured rule-layer decision; it must never be used to authorize runtime execution. JSON v1 is a report contract, not a validated policy import format.
- Codex posture and source inventories are experimental, caller-scoped observations, **not** effective runtime permission comparisons. See the [current v0.4 release-readiness audit](docs/release-readiness-v0.4.md) and [Claude runtime boundaries](docs/claude-runtime-boundaries.md).

Use an isolated environment when repository metadata or Git itself is untrusted. Review the [historical v0.1 audit](docs/audit-v0.1.md) for previously corrected false negatives, but do not treat that audit as current release certification.

## Maintainer responsibilities and support

Maintainers should confirm that **Settings → Security and quality → Advanced Security → Private vulnerability reporting** is enabled, that **Security → Advisories → Report a vulnerability** is visible, and that a responsible maintainer receives security notifications. Follow [GitHub's configuration guide](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository). Record the verification in the relevant release checklist; repository settings cannot be changed by this file.

There is no blanket security-maintenance guarantee for older prereleases and no published support SLA. Check [current release readiness](docs/release-readiness-v0.4.md) and the changelog before making version-specific support claims. A new release, GitHub tag or npm publication requires separate maintainer authorization and verification.
