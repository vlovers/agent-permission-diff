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

The parser accepts _only_ simple root-level double-quoted string assignments, comments, and blank lines. It recognizes `approval_policy = "on-request" | "never"` and `sandbox_mode = "read-only" | "workspace-write" | "danger-full-access"`. Any other key, nested table, duplicate, unsupported value, complex TOML string or inline structure makes the entire snapshot unresolved: recognized values are suppressed, and `compareCodexPosture` reports `uncertain: true`, never a seemingly certain subset.

Unsupported input values are not echoed in diagnostics; 64 KiB input cap, no TOML evaluation, no hook execution, no network access. Neither method reads files or infers config precedence. A caller must supply inert text. This is **not a general TOML parser**.

**Unsupported and unverified:** inherited/user/managed settings, project trust, profile resolution, sandbox network/permissions, command rules, granular approval, runtime approvals, effective filesystem/network access, real precedence and all other Codex config fields. `runtimePermissionDiff: false` intentionally refuses to claim runtime authorization even for recognized settings. Compare with [source provenance](permission-source-provenance.md).

The existing Claude Code CLI and JSON report v1 are unchanged. The supported provider for _semantic permission diffs_ remains Claude Code's documented bounded rule model.

## Git revision comparison (experimental CLI)

Run from the repository root with the compared commits already available locally:

```sh
rulewitness codex-posture HEAD~1 HEAD --json
```

This command reads only the regular `.codex/config.toml` blob from each exact commit. It does not checkout, fetch, execute the config, follow symlinks, or use Codex. Unsafe tree modes and oversized blobs are rejected. Missing config produces uncertainty. Known changes are limited to the strict two-key parser; unrecognized TOML yields `uncertain: true` and no partial posture transitions. The result always includes `runtimePermissionDiff: false`.

The CLI deliberately offers only `--json` for this experimental command, separate from the existing Claude permission `compare`, `scan`, `test` and `--fail-on` gate. The project trust condition and higher-priority configuration layers are not established from Git history. See [official Codex configuration basics](https://developers.openai.com/zh-Hans/docs/config-file/config-basic).
