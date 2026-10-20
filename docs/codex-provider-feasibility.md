# Codex provider feasibility — preliminary research (v0.4)

Status: **research only** (2026-10-21). Codex support is NOT implemented or advertised. References describe published documentation, not a runtime conformance result.

## Primary references

- [Codex basic configuration](https://developers.openai.com/docs/config-file/config-basic) — user and project configuration, precedence and trust-dependent project loading.
- [Codex configuration reference](https://developers.openai.com/docs/config-file/config-reference) — approval_policy, sandbox_mode, managed requirements, trust and filesystem/network settings.
- [Official plugin documentation](https://developers.openai.com/plugins/build/plugins) — repository-local plugin configuration, trusted projects and lifecycle hooks.

URLs are documentation entry points; confirm the exact currently served English page and pin a Codex CLI version before writing conformance fixtures.

## Preliminary findings

Codex uses `~/.codex/config.toml`, trusted-project `.codex/config.toml`, CLI overrides, profiles, user, managed and system configuration layers. Trusted-project files are not the whole effective policy: trust state, CLI flags and managed requirements can change the result. Its approval and sandbox settings are **not** interchangeable with Claude Code's Bash allow/ask/deny rules.

Concrete example settings from the official reference:

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
[sandbox_workspace_write]
network_access = false
```

A Git-revision diff of a tracked project `.codex/config.toml` can at most establish a **conditional project-layer configuration change**. Without explicit ambient assumptions it cannot prove that effective runtime permissions changed. A future report must name these assumptions and preserve unknown coverage. Do not infer that a permissive-looking setting bypasses managed requirements.

## Proposed research matrix (not verified)

| Case | What must be demonstrated |
| --- | --- |
| Project trust | Same Git tree under trusted and untrusted project state |
| CLI overrides | Explicit approval/sandbox options take priority when permitted |
| User/system/managed layers | Differences between tracked project settings and effective configured values |
| Nested projects | Which project config applies at a specific working directory |
| Requirements | Restrictions that cannot be overridden by project or CLI settings |
| Sandbox/network | Distinct permissions, not one generic ALLOW bit |
| Unsupported/invalid TOML | Explicit parse errors or UNKNOWN, no silent fallback |
| Command rules and hooks | Their separately documented syntax, ordering, applicability and trust model |

## Boundaries for RuleWitness

1. Do not reuse Claude Code's deny > ask > allow evaluator or Bash glob equivalence as Codex semantics.
2. Do not execute hooks, commands, plugins, scripts or repository-provided config when scanning.
3. Do not read a developer's home directory to guess ambient policy in a pull request workflow.
4. Do not label a tracked-project setting delta as a verified runtime authorization change.
5. Do not return successful semantic equivalence when an unsupported setting or precedence layer could change an outcome.
6. Keep current JSON v1 and default Claude Code CLI unchanged while this research is incomplete.

## Next gate

Before an implementation PR: independently fetch and archive version-specific documentation, verify command-rule and configuration-precedence behavior against a pinned Codex CLI in disposable repositories, document counterexamples and uncertainty, and decide whether a narrowly scoped model provides defensible value. Until then ship **no Codex provider flag**.
