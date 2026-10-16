# AgentPermissionDiff

A small, offline TypeScript CLI and library for comparing the effective **configured permission rule policy** of AI coding agents across Git commits. First provider: Claude Code.

It compares decisions after rule precedence and wildcard matching, rather than reporting changed JSON lines. Adding an allow rule underneath a matching deny rule produces no permission finding. Widening an allow rule can produce a finding even if the rule's tool name stays the same.

**MVP scope:** tracked, root-level `.claude/settings.json` and `.claude/settings.local.json`; Bash rule matching and bare WebSearch permissions. This is a partial model of the configuration rule layer, not a Claude Code runtime emulator or an assurance that an operation can execute. Every report has `complete: false`. Review coverage diagnostics alongside findings.

## Requirements and local use

Node.js 24 and Git with `--no-lazy-fetch` support (documented in Git 2.47 and later). Older Git fails closed. There are no runtime npm dependencies, network requests, AI API calls, or telemetry in the CLI/library.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node dist/cli.js scan
node dist/cli.js scan HEAD~1 --json
node dist/cli.js compare main HEAD
node dist/cli.js compare main HEAD --json
```

Run at the repository root. `scan` defaults to `HEAD`; neither command reads the working copy. Revisions must resolve to commits. Uncommitted and untracked settings do not participate. An initial repository needs a commit before it can be scanned. The executable name in the package is `agent-permission-diff`; this project is not yet published to npm.

Exit codes: `0` means a report was produced (including findings or incomplete coverage), `2` means invalid arguments, a Git/read failure, or an analysis resource limit. Finding severity does not change the exit code. Consumers must inspect `findings`, `policies[].issues`, and `complete`; an empty finding list is not a security pass.

## Example

Before:

```json
{ "permissions": { "ask": ["Bash"], "allow": ["Bash(npm test)"] } }
```

After:

```json
{ "permissions": { "ask": ["Bash(npm test)"], "allow": ["Bash(npm *)"] } }
```

The broad ask originally masks the allow. Afterward, another matching command such as `npm run build` changes from `ASK` to `ALLOW` (`HIGH`). The report supplies a deterministic representative witness, plus the before/after commit, file, JSON pointer, and determining rule(s). The witness may differ from this example and is never executed. Witnesses are abstract rule-input strings, not recommended shell commands or proof that a command exists.

## Supported semantics

| Feature               | Behavior                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Decisions             | `ALLOW`, `ASK`, `DENY`, `UNKNOWN`                                                                                   |
| Precedence            | Deny wins over ask, which wins over allow; specificity and list order cannot override it                            |
| Settings sources      | Both tracked project permission lists are merged; local rules cannot erase shared rules                             |
| Bash                  | Bare `Bash`, `Bash(*)`, exact text, and `*` anywhere in a supported specifier                                       |
| Bash boundary         | A sole trailing ` *` also matches the bare prefix; `ls *` excludes `lsof`, while `ls*` includes it                  |
| Legacy Bash           | A trailing `:*` normalizes to ` *` when unambiguous; single-identifier colon selectors in ask/deny remain `UNKNOWN` |
| WebSearch             | Bare tool rules; no match means `ASK` under the manual-mode assumption                                              |
| No Bash match         | `UNKNOWN`; built-in read-only approvals vary by input and are not modeled                                           |
| Unknown configuration | Coverage diagnostics; potentially affected tools become `UNKNOWN`                                                   |

The analysis assumes a trusted project and a manual/default session with no external permission sources. Missing `defaultMode` uses that analytical assumption; it does not assert what mode a user's installed Claude Code would select. Explicit `default` and `manual` are accepted. Other modes are unknown.

Supported Bash specifiers use printable ASCII and exclude shell control syntax, quoting, substitutions, redirects, and parameter selectors. `*` is a rule wildcard. Literal `?`, brackets, parentheses, and ambiguous parameter syntax are conservatively unsupported. In ask/deny, `Bash(name:*)` might refer to a scalar parameter, so it is now unknown; use the documented space form `Bash(name *)` for a command prefix. Multiword legacy prefixes such as `Bash(git push:*)` and allow-list legacy prefixes remain supported. Literal wrapper/find command forms (`watch`, `setsid`, `ionice`, `flock`, `find`, `timeout`, `time`, `nice`, `nohup`, `stdbuf`, `command`, `builtin`, `noglob`, `xargs`) followed by whitespace or end of pattern are also unknown, including exact forms, until their runtime behavior is modeled.

The matcher and `evaluate()` operate on raw rule-input text; they do not split compounds, unwrap commands, normalize assignments, or perform filesystem checks. Even a broad supported pattern can match input whose runtime authorization differs. For example, `evaluate()` can return the configured `ALLOW` for a compound string that Claude Code would split and reject. It must never be used as an authorization API. Runtime-sensitive patterns beginning with wildcards or other spellings can escape the literal wrapper guard. Runtime-complete Bash comparison remains a release blocker; see [the audit](docs/audit-v0.1.md).

Unmodeled settings are never executed or assumed harmless. Unsupported tools (including Read/Edit path rules, MCP, Agent, PowerShell and WebFetch) conservatively affect the whole policy because tool interactions can matter. Unsupported Bash/WebSearch specifiers affect that tool. Unknown keys inside `permissions`, hooks, sandbox settings, plugins and other top-level settings affect the whole policy. Only a string `$schema` metadata value is ignored. `model` and `effortLevel` are now unknown rather than silently ignored: this tool cannot validate their provider schema or infer invalid-file recovery. Unsupported values use type-preserving, object-key-sorted JSON fingerprints rather than being echoed. Arrays retain their order.

Changes to unsupported configuration generate a `coverage` finding. Changes to supported rules under an unchanged relevant unknown setting also generate a coverage finding, with `UNKNOWN` on both sides and the changed rule evidence. Missing knowledge does not establish equivalence. Coverage findings are instructions to review missing semantics, not proven permission escalations; they can conservatively flag redundant rule changes under unknown settings. Duplicate/reordered normalized supported rules are ignored. With no relevant unknown settings, legacy-equivalent patterns, redundant grants, and deny-masked changes produce no permission findings.

## Reports and severity

JSON includes `schemaVersion: 1`, the provider/scope, resolved commit IDs, policies, coverage issues, and findings. Each permission finding has a tool, witness, severity, and before/after decisions with evidence. Evidence uses RFC 6901 JSON pointers (no line-number guessing). Defaults explain their reason and have no determining rule. Human output escapes configuration strings to avoid terminal-control injection.

JSON v1 field names, types and decision/severity enums are retained by the audit fixes. Findings and reasons can change as bugs are fixed. Treat messages, ordering, witnesses and fingerprints as diagnostic data, not stable identifiers; fingerprints from different analyzer versions are not comparable. Policy objects passed to library functions must come from this version's `parsePolicy` or `readPolicy`; serialized reports are data, not a validated policy import format.

The severity function uses only the decision transition; it does not infer command danger from keywords:

| Before → after | DENY   | ASK    | ALLOW  | UNKNOWN |
| -------------- | ------ | ------ | ------ | ------- |
| DENY           | INFO   | MEDIUM | HIGH   | MEDIUM  |
| ASK            | LOW    | INFO   | HIGH   | MEDIUM  |
| ALLOW          | LOW    | LOW    | INFO   | MEDIUM  |
| UNKNOWN        | MEDIUM | MEDIUM | MEDIUM | INFO    |

Unchanged decisions produce no comparison finding. Coverage changes are always `MEDIUM`, including `UNKNOWN → UNKNOWN`. Scan entries are an informational inventory, not transition risk findings.

## Library

```ts
import {
  readPolicy,
  comparePolicies,
  evaluate,
  formatHuman,
} from "agent-permission-diff";

const before = readPolicy(process.cwd(), "main");
const after = readPolicy(process.cwd(), "HEAD");
const report = comparePolicies(before, after);
console.log(formatHuman(report));
console.log(evaluate(after, "Bash", "npm test"));
```

`parsePolicy(revision, files)` accepts an in-memory mapping from settings file paths to JSON text. `scanPolicy(policy)` returns a decision inventory. Library Git operations are synchronous and throw on failures. No configuration code is imported.

## Architecture and limits

- `git.ts`: resolves commits, checks regular blob modes, and reads two allowlisted paths. It never follows settings symlinks, checks out commits, fetches, or invokes configuration commands.
- `policy.ts`: validates the supported subset, normalizes patterns, merges rules, and evaluates precedence with source evidence.
- `glob.ts`: glob NFAs and a product-state traversal. Literal characters plus an OTHER character represent every input equivalence class. This detects wildcard differences symbolically instead of sampling commands.
- `compare.ts`: compares acceptance regions, suppresses unchanged decisions, and assigns deterministic severity. One representative is retained per transition and determining-evidence combination; reports are not an enumeration of every possible command.
- `report.ts` / `cli.ts`: human/JSON output and strict positional command parsing. `index.ts` exports the library API.

Limits: 2 MiB per Git output or library settings input, 64 levels of unsupported-value nesting, 1,000 characters per rule, 128 unique combined patterns / 8,192 total pattern characters per tool, 20,000 product states, and 2,000,000 symbolic work units (active-state memberships plus per-pattern transition overhead). A resource limit produces an error, never a successful empty report. Git input must be valid UTF-8; invalid byte sequences fail rather than being replaced. A BOM is preserved and conservatively treated as invalid JSON. Large or adversarial policies may require smaller comparisons. Output is deterministic for the same policies and ordering.

User/home settings, credentials, managed policies, CLI flags, session approvals, environment overrides, workspace trust, nested settings, skills/agent frontmatter, plugin-defined hooks, MCP metadata, and runtime filesystem/sandbox behavior are outside the inspected inputs. External constraints are not discovered. Shared settings are associated with Claude Code's primary working directory; local settings may come from the main checkout in a worktree, with platform/ownership exceptions. This tool reads only the current revision's root-level tracked snapshot, even in worktrees. It does not reproduce that runtime discovery. Tracked local settings require workspace trust too. Unknown configuration can intentionally reduce precision. Changes outside the two allowlisted files are not analyzed or reported; `complete: false` also covers these omissions. Git itself and the local repository configuration are part of the trusted execution environment; use an isolated environment for repositories with untrusted Git metadata.

Analysis uses `rev-parse`, `ls-tree` and `show`, with no shell. Git optional locks, replace objects, lazy fetching, terminal prompting and user/system Git configuration are disabled for the reader. Inherited Git variables are removed case-insensitively; an empty protocol allowlist additionally blocks transports. An unsupported `--no-lazy-fetch` option is an error. The checkout/index are untouched. It does not inspect credentials or invoke hooks, credential helpers, package scripts, or commands mentioned in settings. Reports may contain sensitive permission strings already stored in analyzed settings; handle reports accordingly.

## Development

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run format:check
```

Tests cover precedence, list merging, wildcards/boundaries, unknown semantics, unchanged effective permissions, evidence replay, all severity transitions, an independent glob oracle, Git/CLI behavior, symlink rejection, non-execution, and checkout/index preservation. CI runs these checks on Node.js 24 with read-only repository permissions. Dependabot maintains development dependencies and GitHub Actions.

See [research and source notes](docs/research.md), [contributing](CONTRIBUTING.md), [security](SECURITY.md), and the [MIT license](LICENSE).
