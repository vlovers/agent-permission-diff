# Security policy

AgentPermissionDiff 0.1.x is an experimental static analyzer. It is not a sandbox, enforcement mechanism, or complete model of Claude Code runtime permissions. See README for the supported scope and unknowns.

The analyzer must not execute analyzed configuration, fetch revisions, read machine credentials, send configuration over the network, or modify Git state. Fixed Git subprocesses and bounded JSON/glob processing are the principal input boundaries. Reports contain original supported permission strings and should be treated as potentially sensitive. Unsupported values are represented by fingerprints, not redacted copies with a confidentiality guarantee; fingerprints can be guessed for low-entropy values.

Run analysis in an isolated environment when repository metadata or Git itself is untrusted. Resource limits reduce, but do not eliminate, denial-of-service risk. An empty finding list or exit code 0 does not prove a repository safe. `complete` remains false for this MVP.

The [v0.1 audit](docs/audit-v0.1.md) records corrected false-negative cases and remaining limits. The library's `evaluate()` returns raw configured rule-layer decisions; it must never be used to authorize execution. Unsupported Git no-lazy-fetch behavior, malformed UTF-8 and analysis-limit failures produce an error rather than a partial success report. JSON v1 is a report format, not a validated policy import format.

For a vulnerability, use the hosting repository's private vulnerability reporting feature if it is enabled. If no private channel exists, open a minimal issue requesting a private contact without including exploits, secrets, or sensitive configuration. A dedicated security contact has not yet been established for this unpublished project. Do not post credentials in an issue or pull request.

Only the latest 0.1.x revision is intended to receive fixes during the MVP phase; no response-time guarantee is offered.
