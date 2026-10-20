# RFC: RuleWitness v0.4 provider architecture

Status: **proposal for review**, not implemented. Baseline: published v0.3.0. This RFC does not claim support for any provider other than the documented Claude Code subset.

## Current implementation inventory

| Boundary | Today | Implication |
| --- | --- | --- |
| `src/git.ts` | `readPolicy(repository, ref)` reads two fixed `.claude` paths via read-only Git, rejects symlinks, disables transport and lazy fetch | Provider discovery must never execute or source configuration |
| `src/policy.ts` | Parses Claude permissions, emits rules and issues; `evaluate` applies deny, ask, allow with conservative UNKNOWN | Provider-specific parsing and decisions must not be conflated with another agent's syntax |
| `src/glob.ts` | Bounded Bash pattern regions and concrete witnesses | Its language is not a universal permission-expression engine |
| `src/compare.ts` | Hard-coded Bash/WebSearch tool inventory, witness replay and Claude-specific report metadata | A future provider needs its own supported input-domain partitioner, not just a name switch |
| `src/explain.ts` | Explanations, witness validation, exit gates and limitations | Preserve evidence and uncertainty semantics in all implementations |
| `src/types.ts` | JSON schemaVersion 1 and literal provider `claude-code`; report.complete is false at runtime | Do not widen or silently reinterpret v1 fields |
| `src/cli.ts` | `scan`, `compare`, `test` without provider selection | Default commands must continue to behave exactly as in v0.3 |
| `src/index.ts` | Exports existing public types and helpers | Existing import names, function signatures and output fixtures are compatibility obligations |

## Compatibility contract (must pass before implementation)

1. The unmodified v0.3 CLI commands, JSON schema v1, legacy binary alias, TypeScript exports, report ordering, severity gates (exit 0/1/2/3), PR Markdown and test fixtures remain supported.
2. The current `provider: "claude-code"` and `scope: "tracked-project-rule-policy"` are unchanged in schema v1; do not attach an unversioned alternate-provider payload to v1.
3. Introduce a **separately versioned** multi-provider envelope only when an external consumer test validates its serialization and migration. The proposed example below is illustrative, not a shipped API.
4. Any explicit unsupported provider, ambiguous detection, incomplete parse, missing revision or unknown decision fails closed with an error or prominent uncertainty. No default `ALLOW`, no fallback to Claude rules.
5. Report `complete: false` until an explicitly reviewed provider-specific scope establishes otherwise. Neither a known modeled decision nor exit 0 constitutes runtime authorization.

## Proposed internal boundaries

```ts
// Design sketch only: not exported, shipped, or assigned a schema version.
type ProviderId = string;
interface ProviderDescriptor {
  id: ProviderId;
  modelRevision: string; // pinned analyzer semantics, not an agent version claim
  evidenceSources: readonly string[];
}
interface ProviderAdapter<Snapshot, Candidate> {
  descriptor: ProviderDescriptor;
  detect(tree: ReadonlyGitTree): "present" | "absent" | "ambiguous";
  load(tree: ReadonlyGitTree): Snapshot; // inert, bounded bytes only
  validate(snapshot: Snapshot): readonly CoverageDiagnostic[];
  candidates(before: Snapshot, after: Snapshot): Iterable<Candidate>; // bounded
  evaluate(snapshot: Snapshot, candidate: Candidate): Evaluation;
  replay(before: Snapshot, after: Snapshot, candidate: Candidate): boolean;
}
```

The design separates detection, loading, validation, candidate generation and evaluation. `ReadonlyGitTree` should be a narrow, fixed-argument interface wrapping the existing hardened Git reader. It must not accept executable callbacks, arbitrary shell strings, path traversal, Git config overrides, URLs or lazy object fetching. Provider adapters cannot create processes, load plugins from the compared revision or read arbitrary local files.

A candidate is a provider-defined semantic input, not necessarily a shell command. The comparator can share deterministic reporting, evidence sorting, coverage diagnostics and gate presentation, **but must not assume** a global DENY > ASK > ALLOW precedence, the Bash wildcard language, identical defaults or the same authorization vocabulary across providers. Use a provider-specific decision algebra with explicit `unknown`/not-modelled outcomes; map to cross-provider classifications only where a documented, tested equivalence exists.

### Detection and selection

For v0.4, recommend an explicit `--provider` for experimental adapters (in a future separate implementation PR). Keep unflagged `scan`, `compare` and `test` Claude-only for compatibility. Never silently switch the default when more files appear. An eventual `auto` mode must reject ambiguous or mixed configurations and publish a detection trace. A missing provider file is not evidence of broad runtime safety.

### Versioned report proposal

A future envelope might contain `schemaVersion: 2`, `provider: { id, modelRevision }`, `scope`, `complete: false`, `revisions`, `diagnostics` and `findings`. This is **not** a schema commitment: decide the actual representation using golden snapshots and installed-package consumer tests. Schema v1 output and consumers must remain accessible under explicit compatibility rules. Evidence must carry exact commit and file provenance without reading secrets unrelated to the configured scope.

## Threat model and rejection cases

- Treat Git trees, settings, comments, strings, JSON pointers and witness text as attacker-controlled data. Do not invoke scripts, hooks, filters, aliases, external providers, package managers or shell interpretation when examining PRs.
- Keep revision resolution read-only with exact commit verification, strict UTF-8, symlink rejection, object/path limits and disabled fetching. Distinguish missing objects from absent configuration.
- Apply deterministic resource bounds to file size, nesting, rule count, candidate enumeration, witness replay, execution time and rendered output.
- Do not leak confidential rules through public job summaries or PR comments by default. Preserve Markdown escaping and diagnostic sanitization.
- A changed unsupported setting cannot be reported as proven no-op; stable unsupported state cannot be treated as proof of known behavior. Err toward UNKNOWN.
- Never process provider configuration from a fork by running it with `pull_request_target` write credentials.

## Validation plan for implementation PRs

1. Golden v0.3 compatibility suite for CLI, library declarations, JSON v1, Markdown, package exports and exit codes.
2. Disposable Git repositories: exact base/head SHA, missing objects, malformed/unsupported configuration, symlinks, dirty worktree and fork-shaped read-only flow.
3. Provider-neutral comparator tests with a **synthetic** in-memory adapter to verify partitioning, bounded witnesses, replay and UNKNOWN handling. Synthetic fixtures prove architecture only, **not external agent support**.
4. Provider-specific conformance fixtures referenced to official, version-specific documentation and, where feasible, native runtime behavior. Capture precedence, nested configuration, defaults, missing files and unsupported syntax.
5. Node.js 24 typecheck, unit tests, build, packed npm install, installed ESM and CLI smoke tests, CI and security review before merge.

## Research gate for a second provider

Codex is a **candidate**, not supported. Before implementation, document the official versioned config format, file search/precedence, project/user/managed layers, approvals/sandbox policies, trust behavior and rules syntax. Identify which effective decisions can be observed and which require runtime state. If primary sources or conformance experiments do not justify a trustworthy narrow model, publish a feasibility note and stop. Do not translate Claude allow/ask/deny arrays into Codex permissions by analogy.

## Explicit non-goals

No runtime authorization promise, no silent multivendor auto-detection, no JSON v1 rewrite, no new provider advertised, no write-token PR comments, and no npm publication from this documentation PR.
