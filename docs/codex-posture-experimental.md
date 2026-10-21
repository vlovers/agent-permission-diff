# Experimental Codex configuration posture inventory

This **does not add effective Codex permission analysis**. It only inventories two explicitly recognized top-level project settings from a tiny, unambiguous TOML subset. Comparisons are **posture changes**, not a semantic decision about which commands Codex can execute. The runtime permission diff flag is always `false`.

Official references reviewed 2026-10-21:

- [Configuration basics](https://developers.openai.com/codex/config-basic): user, profile, project, CLI and managed layers; project files depend on trust.
- [Configuration reference](https://developers.openai.com/codex/config-reference): `approval_policy` and `sandbox_mode`, including granular approval settings and managed restrictions.

```ts
import { inspectCodexPosture, compareCodexPosture } from "rulewitness";

const before = inspectCodexPosture(
  'approval_policy = "on-request"\nsandbox_mode = "read-only"',
);
const after = inspectCodexPosture(
  'approval_policy = "never"\nsandbox_mode = "workspace-write"',
);
const review = compareCodexPosture(before, after);

console.log(review.changes); // explicit project-config posture changes only
console.log(review.runtimePermissionDiff); // false
console.log(review.uncertain); // false only for the tiny parsed subset
```

A pinned standards-compliant TOML parser (`smol-toml`) handles TOML syntax, including quoting, comments, dotted keys and tables. RuleWitness only extracts the following explicitly modeled project posture fields. It recognizes `approval_policy = "on-request" | "never"` and `sandbox_mode = "read-only" | "workspace-write" | "danger-full-access"`, plus boolean `network_access`, `exclude_slash_tmp`, and `exclude_tmpdir_env_var` inside a single `[sandbox_workspace_write]` table. Any other key, unsupported table, duplicate, or unsupported value makes the entire snapshot unresolved: recognized values are suppressed, and `compareCodexPosture` reports `uncertain: true`, never a seemingly certain subset.

Unsupported input values are not echoed in diagnostics; 64 KiB input cap, no TOML evaluation, no hook execution, no network access. Neither method reads files or infers config precedence. A caller must supply inert text. The TOML syntax parser is general, but posture extraction deliberately covers only the documented fields listed here.

**Unsupported and unverified:** inherited/user/managed settings, project trust, profile resolution, sandbox network/permissions, command rules, granular approval, runtime approvals, effective filesystem/network access, real precedence and all other Codex config fields. `runtimePermissionDiff: false` intentionally refuses to claim runtime authorization even for recognized settings. Compare with [source provenance](permission-source-provenance.md).

The existing Claude Code CLI and JSON report v1 are unchanged. The supported provider for _semantic permission diffs_ remains Claude Code's documented bounded rule model.

## Git revision comparison (experimental CLI)

Run from the repository root with the compared commits already available locally:

```sh
rulewitness codex-posture HEAD~1 HEAD --json
```

This command reads only the regular `.codex/config.toml` blob from each exact commit. It does not checkout, fetch, execute the config, follow symlinks, or use Codex. Unsafe tree modes and oversized blobs are rejected. Missing config produces uncertainty. Known changes are limited to the strict two-key parser; unrecognized TOML yields `uncertain: true` and no partial posture transitions. The result always includes `runtimePermissionDiff: false`.

The CLI deliberately offers only `--json` for this experimental command, separate from the existing Claude permission `compare`, `scan`, `test` and `--fail-on` gate. The project trust condition and higher-priority configuration layers are not established from Git history. See [official Codex configuration basics](https://developers.openai.com/zh-Hans/docs/config-file/config-basic).

## Workspace network posture example

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = false
exclude_slash_tmp = true
exclude_tmpdir_env_var = false
```

The experimental posture reader records `sandbox_workspace_write.network_access: false` as an explicitly configured Boolean; the two temporary-root exclusion settings are inventoried and compared in the same manner. Changes to this setting are **configuration posture changes only**; the actual network boundary also depends on sandbox mode, higher priority settings and runtime enforcement. Missing `network_access` is not assumed to be either `true` or `false`.

This intentionally remains a strict **posture subset**, even though TOML syntax is parsed by a standards-compliant library. Unmodeled arrays such as `writable_roots`, arbitrary profiles, other tables, and extra fields cause uncertainty for the entire input. No effective permission claim is made.
