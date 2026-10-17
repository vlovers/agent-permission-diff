# RuleWitness

**Semantic Permission Diff for AI Coding Agents**

[![RuleWitness CI](https://github.com/vlovers/rulewitness/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vlovers/rulewitness/actions/workflows/ci.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/rulewitness.svg)](https://www.npmjs.com/package/rulewitness)

Detect, explain, and test Claude Code permission changes across Git revisions.

RuleWitness is an experimental, offline TypeScript CLI and library for reviewing **Claude Code configuration-rule decisions** between Git commits. It produces concrete, replay-checked witnesses, explains the determining rules, filters modeled no-ops, and runs reusable policy assertions.

**This is not a runtime authorization engine.** `ALLOW` means the supported configured rules allow that input in this model. It does not guarantee Claude Code will execute it. Every report retains `complete: false`. Unsupported settings and uncertain changes remain visible. Only Claude Code's documented subset below is supported; other agents are not advertised.

This is the v0.2 evolution of AgentPermissionDiff. The repository stays [vlovers/agent-permission-diff](https://github.com/vlovers/rulewitness); the new candidate package is `rulewitness@0.2.0`. See [migration notes](docs/migration-v0.2.md) and [release preparation](docs/release-v0.2.0.md).

## Installation and quick start

Requires **Node.js 24** and Git supporting `--no-lazy-fetch` (documented in Git 2.47+). Local macOS is tested; Linux is exercised by CI. Windows execution/symlinks are not validated.

The candidate has **not been published by this change**. Direct registry requests returned no public entry for `rulewitness` on 2026-10-17; this does not reserve the name or guarantee publish permission. Until a separately authorized release, use this checkout:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node dist/cli.js scan HEAD
node dist/cli.js compare main HEAD --json
npm pack --dry-run
```

To test a local tarball, run `npm pack`, install `./rulewitness-0.2.0.tgz` in a separate consumer with `npm install --ignore-scripts /absolute/path/to/rulewitness-0.2.0.tgz`, and use its `node_modules/.bin/rulewitness` from the target repository root. Packing is local and does not publish.

**After an explicitly authorized npm publication**, the intended commands are:

```sh
npm install --save-dev rulewitness@0.2.0
npx --no-install rulewitness compare main HEAD
npx --no-install rulewitness test
```

The legacy `agent-permission-diff` executable is retained as an alias in the new package. Import paths change to `rulewitness`; the old package name is not an import alias. We retain the executable alias for the v0.2 migration to avoid breaking existing local scripts; it is compatibility-only and all primary examples use `rulewitness`. A later removal would require a documented breaking change.

## 30-second example

Move `Bash(npm run build)` from `permissions.ask` to `permissions.allow` in `.claude/settings.json`, then commit the change. RuleWitness finds the concrete witness `npm run build`: **ASK → ALLOW**, severity **HIGH**. It identifies the determining rules at `#/permissions/ask/0` before and `#/permissions/allow/1` after in the complete example below.

```sh
rulewitness compare HEAD~1 HEAD
rulewitness compare HEAD~1 HEAD --json --fail-on high
rulewitness scan HEAD
rulewitness test --config rulewitness.tests.json --rev HEAD
```

The gated command exits 1 for this known transition. Unsupported configuration instead makes the gate exit 3; threshold violations and uncertainty are reported separately. Inputs are never executed. These commands assume a locally installed candidate or a later authorized npm release.

## Why semantic permission diffs matter

A changed JSON line does not establish a changed decision. Adding an allow beneath a matching deny does nothing to the supported decision model. Widening an exact permission to a wildcard can affect inputs that never appeared in a sample command list.

RuleWitness compares bounded glob automata after applying `DENY → ASK → ALLOW` precedence. It re-evaluates every emitted transition witness against both policies and attaches commit IDs, paths, JSON pointers, reasons, and explicit limitations. No agent, hook, command from a configuration, or assertion input is executed. There are no runtime npm dependencies, network requests, paid AI calls, or telemetry.

Semantic diffs, explanations and CI gates already exist elsewhere. Our focus is the inspectable combination of a narrow documented model, symbolic counterexamples, conservative uncertainty handling, and assertions using the same evaluator. The [research comparison](docs/rulewitness-research.md) credits the related projects and describes differences without claiming uniqueness.

## Example: an explainable permission change

Before, in `.claude/settings.json`:

```json
{
  "permissions": {
    "defaultMode": "default",
    "allow": ["Bash(npm test)"],
    "ask": ["Bash(npm run build)"],
    "deny": ["Bash(git push *)"]
  }
}
```

After:

```json
{
  "permissions": {
    "defaultMode": "default",
    "allow": ["Bash(npm test)", "Bash(npm run build)"],
    "ask": [],
    "deny": ["Bash(git push *)"]
  }
}
```

Both example commits also contain tracked local settings allowing `Bash(npm run lint)`. The build approval changes from `ASK` to `ALLOW`; the other grants and denial are unchanged. Actual installed-CLI output for `rulewitness compare HEAD~1 HEAD`:

```text
RuleWitness — Permission Diff
Scope: tracked-project-rule-policy; runtime authorization is not established.
Revisions: "004faef35fab1f677974ed183fa0f8ee40f97ebc" → "0126081ca8f2348bc0ccdc0862f5dd73827bd9ee"
Coverage: partial (see README for assumptions and unsupported runtime semantics)
Outcome: modeled-change (within the inspected model only)

[HIGH] permission "Bash" "npm run build": ASK → ALLOW
  Before: ASK
  After:  ALLOW
  Why: The modeled decision for this witness changes from ASK to ALLOW.
    Before: Matching ask rule(s) in deny > ask > allow order
    After: Matching allow rule(s) in deny > ask > allow order
  Evidence:
    Before: "004faef35fab":".claude/settings.json"#"/permissions/ask/0" "Bash(npm run build)"; Matching ask rule(s) in deny > ask > allow order
    After:  "0126081ca8f2":".claude/settings.json"#"/permissions/allow/1" "Bash(npm run build)"; Matching allow rule(s) in deny > ask > allow order
  Witness: Bash("npm run build")

Supported configured-rule semantics only; runtime authorization is not guaranteed.
External settings, session state, shell normalization and runtime checks are not established by this report.
```

These hashes belong to deterministic disposable repositories, not this project's history. See the full [JSON comparison](docs/examples/compare.json), [human scan](docs/examples/scan.txt), and [JSON scan](docs/examples/scan.json). JSON v1 retains every existing field and adds optional structured `finding.explanation` data: certainty, summary, evidence-derived steps, and limitations. Older reports without that field remain renderable. Diagnostic strings, ordering, witnesses and fingerprints are not cross-version identifiers.

For a wildcard change from `Bash(npm test)` to `Bash(npm *)`, a newly matched witness such as `npm` has a changed raw-rule decision. Its previous fallback is `UNKNOWN`, so it is reported as uncertain, not a proven escalation. Witnesses are data, never executable demonstrations.

## Example: a harmless masked change

If `deny` contains `Bash(git push *)`, adding `Bash(git push origin main)` to `allow` does not change a modeled decision. The deny still wins. Removing redundant rules, duplicates, reordering, consecutive-star equivalents and supported legacy-equivalent spellings are likewise filtered when equivalence can be established.

Actual installed-CLI output for this deny-masked fixture (`rulewitness compare HEAD~1 HEAD`):

```text
RuleWitness — Permission Diff
Scope: tracked-project-rule-policy; runtime authorization is not established.
Revisions: "285071331fbea361193dc48b63b06e9d1fee8495" → "e056ddac44318a4385848c75999f232741898ae4"
Coverage: partial (see README for assumptions and unsupported runtime semantics)
Outcome: modeled-no-op (within the inspected model only)
No decision changes found within the supported rule model; runtime behavior remains unverified.

Supported configured-rule semantics only; runtime authorization is not guaranteed.
External settings, session state, shell normalization and runtime checks are not established by this report.
```

The full [masked JSON report](docs/examples/masked-compare.json) has an empty `findings` array. Both examples are regenerated and checked byte-for-byte by `npm run test:package`, which creates deterministic disposable Git repositories; their commit hashes are fixture identifiers.

The comparison outcome distinguishes:

| Outcome          | Meaning                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `modeled-change` | At least one supported known-to-known decision changes, with a replay-valid witness                               |
| `modeled-no-op`  | No decision changes in the supported raw model, with no inspected configuration issues; not a runtime no-op claim |
| `uncertain`      | Coverage issues, coverage findings or transitions involving `UNKNOWN` prevent a proven conclusion                 |

An unchanged unsupported hook must not hide changed grants. Such changes produce coverage findings with `UNKNOWN → UNKNOWN` and relevant rule evidence. See [human](docs/examples/unknown-compare.txt), [JSON](docs/examples/unknown-compare.json), and [unknown scan](docs/examples/unknown-scan.json). Unknown configuration is not proof of equivalence.

## Permission policy tests

Create `rulewitness.tests.json` in the target repository root:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "name": "Tests should be allowed",
      "tool": "Bash",
      "input": "npm test",
      "expected": "ALLOW"
    },
    {
      "name": "Git pushes should be denied",
      "tool": "Bash",
      "input": "git push origin main",
      "expected": "DENY"
    }
  ]
}
```

```sh
rulewitness test
rulewitness test --config rulewitness.tests.json --rev HEAD~1 --json
rulewitness test --markdown
```

Policy settings come from the specified commit, default `HEAD`. Test definitions are explicitly read from the current working-tree data file, not from that revision. The file must be regular, resolve within the target repository, and be at most 1 MiB. Unknown keys, duplicate names, unsupported schema versions, empty suites, invalid decisions and more than 1,000 cases are rejected. Names are at most 200 characters, tool names 100 and inputs 4,000. No test input is executed.

Results show expected and actual modeled decisions, pass/mismatch/unknown status, reason and determining evidence. **`UNKNOWN` never passes**, even when expected is `UNKNOWN`. Unsupported tools and inspected policy issues remain unknown. Assertions conservatively reject complex Bash query syntax—including compounds, quoting, substitutions, redirections, globs, leading assignments and known wrapper/find forms—rather than allowing it through a broad raw rule. This intentionally narrower assertion boundary is not a shell parser. Raw `evaluate()` retains its v0.1 matching contract and must not authorize execution.

Tests assert only the listed supported queries. Passing assertions do not prove complete policy or runtime safety. The assertion JSON is a separate version-1 `command: "test"` contract with `results`, `passed`, `revision`, `issues` and `complete: false`.

## CI reporting and exit codes

```sh
rulewitness compare main HEAD --markdown
rulewitness compare main HEAD --json --fail-on high
```

Fetch the necessary refs before comparing them; the CLI itself never fetches. For a pull-request workflow, use an ordinary `pull_request` trigger, read-only contents permissions and checkout with enough history, then compare a trusted base commit SHA with the PR head SHA. Do not run contributor code under `pull_request_target` with elevated permissions.

| Exit | Meaning                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------- |
| `0`  | Ungated scan/compare produced a report; assertions passed; or no reliable finding met an opt-in threshold |
| `1`  | A known decision change meets `--fail-on`, or an assertion mismatched/is unknown                          |
| `2`  | Usage, configuration, Git, decoding or analysis-limit failure; no partial success report is emitted       |
| `3`  | An opt-in comparison gate encountered inspected-model uncertainty, even if no high finding exists         |

With `--fail-on`, JSON v1 adds `gate`:

```json
{
  "threshold": "high",
  "thresholdExceeded": true,
  "uncertain": true,
  "violations": [0],
  "exitCode": 3
}
```

This illustrates a mixed report: a reliable threshold violation exists at `findings[0]` and another inspected setting is unresolved. `violations` contains zero-based indices of known-to-known permission changes only; UNKNOWN transitions do not qualify. Both facts are calculated before choosing an exit code. Precedence is **analysis/usage error (2, no success report) → uncertainty (3) → threshold (1) → scoped pass (0)**. Human and Markdown reports also print both gate facts.

Thresholds are `high`, `medium`, `low`, `info`, apply only to `compare`, and only classify known-to-known permission changes. Uncertainty takes precedence over a threshold failure. No flag preserves v0.1 report-only exit behavior, including exit 0 for uncertain reports. Consumers must inspect `complete`, coverage and findings; exit 0 is never a full security pass. The universal external/runtime scope limit does not itself force every scoped gate to fail: an unchanged issue-free raw model can pass while `complete` stays false.

Severity is deterministic and keyword-independent:

| Before → after | DENY   | ASK    | ALLOW  | UNKNOWN |
| -------------- | ------ | ------ | ------ | ------- |
| DENY           | INFO   | MEDIUM | HIGH   | MEDIUM  |
| ASK            | LOW    | INFO   | HIGH   | MEDIUM  |
| ALLOW          | LOW    | LOW    | INFO   | MEDIUM  |
| UNKNOWN        | MEDIUM | MEDIUM | MEDIUM | INFO    |

Unchanged decisions do not produce comparison findings. Coverage changes are MEDIUM and never masquerade as a proven escalation. Markdown uses a data-dependent fenced block to keep configuration text inert. SARIF is deferred rather than mapping uncertain rule-model findings to misleading code-scanning claims.

## Supported Claude Code semantics

| Feature         | Supported behavior                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Sources         | Root-level tracked `.claude/settings.json` and `.claude/settings.local.json`; lists merge                       |
| Precedence      | Deny before ask before allow, independent of specificity and array order                                        |
| Bash rules      | Bare `Bash`, `Bash(*)`, exact printable-ASCII text and `*` anywhere in supported specifiers                     |
| Prefix boundary | A sole trailing ` *` also matches the bare prefix; `ls *` excludes `lsof`, `ls*` includes it                    |
| Legacy suffix   | Allow-list `:*` and unambiguous multiword prefixes normalize to ` *`; ambiguous ask/deny `name:*` stays unknown |
| WebSearch       | Bare rules; unmatched default is ASK under the fixed manual-mode assumption                                     |
| No Bash match   | UNKNOWN; built-in runtime read-only approvals are not guessed                                                   |

The analysis assumes trusted project settings, a manual/default session, and no discovered external permission sources. Missing `defaultMode` uses this analytical assumption, not a claim about installed defaults. Explicit `default` and `manual` are accepted; other modes are unknown. See current official [permissions](https://code.claude.com/docs/en/permissions) and [settings](https://code.claude.com/docs/en/settings) documentation, plus the [research notes](docs/rulewitness-research.md).

## Unsupported semantics and limitations

- Shell parsing/normalization, built-in approvals, runtime path checks, redirects, protected files, workspace trust, sandbox enforcement, hooks, session approvals and non-manual modes are not modeled. Broad raw patterns can cover inputs the runtime rejects. A witness proves a raw modeled transition, not command availability or execution.
- Quoting, shell controls, substitutions, non-ASCII rule text, parameter selectors and literal wrapper/find command forms are unsupported. Conservative guards do not implement their semantics. Other tools—including Read/Edit paths, WebFetch, MCP, Agent and PowerShell—remain unknown. Only a string `$schema` metadata value is ignored; `model`, `effortLevel` and other unmodeled settings produce coverage diagnostics.
- User/managed/CLI settings, environment overrides, untracked local settings, nested settings, main-checkout/worktree discovery, skills/plugins and files outside the two allowlisted paths can change runtime behavior without a finding. Runtime/provider compatibility is not established by documentation review. Windows is unverified.
- Configuration diagnostics may conservatively flag redundant rule changes under unknowns. An empty finding list is not a complete security audit. Supported raw decisions do not describe tool visibility or lifecycle/session behavior.
- Library policies must come from this version's parser/reader. Serialized reports are data, not a validated policy import format. Original supported permission strings may contain sensitive information; handle reports accordingly. Fingerprints can be guessed for low-entropy unsupported values.

Bounds: 2 MiB per settings/Git output, 1,000 characters per rule, 64 unsupported-value nesting levels, 128 unique combined patterns / 8,192 pattern characters per tool, 20,000 product states and 2,000,000 symbolic work units. Assertions additionally cap estimated input-by-pattern work at 10,000,000 units. Limits fail explicitly. Git decoding is strict UTF-8; BOMs remain conservatively invalid JSON. Limits reduce denial-of-service risk but are not a hard process sandbox.

Git operations are fixed argv `rev-parse`, `ls-tree`, `show` calls against resolved commits. Optional locks, replace objects, transports, lazy fetch, prompting and user/system Git config are disabled; inherited Git variables are scrubbed. Settings symlinks are not followed. No checkout, index write, remote contact, helper/hook execution or configuration mutation is performed by the analyzer. Git and local repository metadata remain trusted execution inputs.

## TypeScript library

```ts
import {
  readPolicy,
  comparePolicies,
  validateWitness,
  comparisonOutcome,
  formatMarkdown,
  parseTestConfig,
  runPolicyTests,
} from "rulewitness";

const before = readPolicy(process.cwd(), "main");
const after = readPolicy(process.cwd(), "HEAD");
const report = comparePolicies(before, after);
for (const finding of report.findings) {
  if (finding.kind === "permission") {
    console.log(validateWitness(before, after, finding));
  }
}
console.log(comparisonOutcome(report));
console.log(formatMarkdown(report));

const cases = parseTestConfig(
  JSON.stringify({
    schemaVersion: 1,
    cases: [
      { name: "Tests", tool: "Bash", input: "npm test", expected: "ALLOW" },
    ],
  }),
);
console.log(runPolicyTests(after, cases).passed);
```

Existing exports remain: `parsePolicy`, `evaluate`, `readPolicy`, `scanPolicy`, `comparePolicies`, `severity`, `formatHuman`, `SETTINGS_FILES` and their types. New exports include `explainFinding`, `validateWitness`, `comparisonOutcome`, `comparisonExitCode`, `assessComparisonGate`, `hasUncertainty`, `relevantIssues`, `formatMarkdown`, `parseTestConfig`, `readTestConfig`, `runPolicyTests` and typed assertion/explanation contracts. No global mutable configuration is introduced.

The architecture extends the existing parser/evaluator, Git reader and NFA matcher with small explanation and assertion modules. Rendering and CLI routing stay separate from analysis. See [migration](docs/migration-v0.2.md) for precise compatibility details.

## Development

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run test:package
npm run format:check
npm pack --dry-run
```

Existing tests are preserved and extended. Tests cover precedence, wildcard boundaries, overlaps, shadowing, equivalent rules, unknowns, independent recursive/regex glob oracles and a separate dynamic-programming policy oracle, 200 seeded policy pairs with exhaustive inputs of length 1–5 over a four-character alphabet, replay, hostile revisions/data, limits, read-only behavior, assertions, Markdown and CI exits. Package tests build a local tarball, install it offline **outside the source repository**, compile an independent TypeScript consumer, verify both bins, and compare deterministic CLI captures. They never run configured commands. CI uses Node.js 24 and read-only GitHub permissions. These model checks do not establish native Claude Code conformance; see the [final review](docs/final-review-v0.2.md).

To deliberately refresh captures after a reviewed output change, build and run `RULEWITNESS_UPDATE_EXAMPLES=1 npm run test:package`, then update this README's actual output and inspect every diff. The legacy `APD_UPDATE_EXAMPLES=1` switch remains a test-maintenance alias. Captured JSON is excluded from reformatting so it stays byte-for-byte CLI output.

## Contributing and security

Contributions should extend the documented model conservatively, include primary sources and regression tests, and preserve coverage diagnostics. See [CONTRIBUTING](CONTRIBUTING.md), the MIT [LICENSE](LICENSE), [SECURITY](SECURITY.md), and [publishing checklist](docs/release-v0.2.0.md). The maintainer can use the [exact GitHub metadata and rename checklist](docs/github-rename.md) after merge and explicit authorization; current links remain valid until then. Historical v0.1 audit/release documents are retained as historical records of AgentPermissionDiff, not retroactive claims about RuleWitness.

Use the repository's private vulnerability reporting form when enabled; never post secrets or exploits in a public issue. Reporting enablement and maintainer ownership must be verified before publication. This work does not publish to npm, create a GitHub release/tag, rename the repository, modify security settings or merge its PR.
