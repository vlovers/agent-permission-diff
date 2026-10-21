# Claude Code permission boundaries: trust, precedence, and coverage

This is an **evidence/compatibility audit**, not a claim of runtime authorization conformance. RuleWitness v0.4's public evaluator compares a deliberately narrow **tracked project rule model**, not effective permission decisions of a live Claude Code session.

Primary references (re-review when Claude Code changes):

- [Claude Code permissions](https://code.claude.com/docs/en/permissions)
- [Claude Code settings](https://code.claude.com/docs/en/settings)
- [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)

## Trust boundary

Project-scoped settings require the runtime's applicable project/trust conditions. The Git commit alone cannot prove which directories are trusted, which session mode is active, or what higher-priority managed/user/CLI settings apply. In particular:

- A modeled `ALLOW` is an **allow-rule match conditional on this model**, **not** a promise that Claude Code would execute the request.
- A modeled `DENY` is a deny-rule match conditional on the inspected sources and modeled rule syntax, not proof that the full runtime decision graph is understood.
- The repository cannot establish that untracked `settings.local.json`, user settings, managed settings, CLI overrides, active hooks, dynamic approvals, or an ancestor project's settings are absent.
- All reports must retain `complete: false`. Do not promote modeled `ALLOW` to an unconditional runtime permission.

Do **not** interpret comparing two commits as comparing two trusted live sessions. Git revisions are inert evidence; session trust and runtime context are independent inputs.

## What the current parser actually models

| Input | Modeled interpretation | Limit |
| --- | --- | --- |
| `.claude/settings.json` tracked regular file | Parse supported project rules | Settings only present in Git revision |
| `.claude/settings.local.json` tracked regular file | Parse supported local rules | Normally untracked local state is unseen |
| `permissions.deny` matching Bash/WebSearch | `DENY` | Narrow literal/wildcard syntax only |
| `permissions.ask` matching Bash/WebSearch | `ASK` | Narrow literal/wildcard syntax only |
| `permissions.allow` matching Bash/WebSearch | `ALLOW` | Conditional configured-rule match |
| Explicit `defaultMode: "default"` or `"manual"` | Manual/default analytical model | `manual` is documented as alias |
| Missing `defaultMode` | Same analytical assumption | Does not establish live session default |
| Other `defaultMode`, hooks, unrecognized settings | Coverage issue, `UNKNOWN` | No invented behavior |
| Unmatched Bash | `UNKNOWN` | Built-in approvals and shell transformations unmodeled |
| Unmatched WebSearch | `ASK` under assumed manual mode | Conditional on the assumed mode |

The supported subset checks `deny > ask > allow` precedence **among parsed rules**. It does not attempt to implement the full runtime permission pipeline (hooks, policy mode, built-in permissions, trust, approvals or hierarchy).

## Comparative uncertainty

- A transition involving `UNKNOWN` is not proven permission escalation or de-escalation.
- If unsupported configuration is stable but supported rules change, RuleWitness emits `UNKNOWN → UNKNOWN` coverage findings rather than describing the change as a semantic no-op.
- Two policies can produce no modeled finding while live behavior differs because of external state. `modeled-no-op` is never a runtime-equivalence guarantee.
- `--fail-on` thresholds concern **proven modeled known-to-known** transitions. Under uncertainty, the gate must use the documented uncertainty outcome, not silently pass.

## Security expectations

Read snapshots from exact, locally available commit objects only. Do not execute inspected shell commands, hooks or config files, and do not fetch remotes. Never resolve symlink targets/submodules as trusted project settings. Keep diagnostics bounded and avoid echoing sensitive unsupported configuration values.

## Future expansion acceptance criteria

Before expanding runtime claims, add a versioned, testable session-context input design covering: trusted directories; managed/user/project/local settings and their precedence; dynamic permission mode; hooks and user approvals; agent-specific runtime version. Until then, an explicit conservative `UNKNOWN` is preferable to a false `ALLOW`.

This audit does not add a provider, extend the CLI schema, or change severity/exit-code contracts.
