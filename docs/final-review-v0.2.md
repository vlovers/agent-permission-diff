# RuleWitness v0.2 final technical review

Reviewed 2026-10-17 on `feat/rulewitness-v0.2`, continuing PR #5. The tracked working tree initially matched `5d812f6d24d432bdfc181adaf9c940f0ce0ca0eb`; main, the existing v0.1.0 tag, worktree inventory and unrelated `.idea` files were preserved. Both existing PR checks were successful. Dependabot PRs are independent of this review.

## Findings and corrections

**Medium — mixed uncertainty and severity were not separately exposed by the gate.** The old early return correctly failed uncertain analysis with exit 3, but callers could not distinguish that alone from an additional reliable HIGH violation using a structured gate result. `assessComparisonGate()` now computes both facts, reliable finding indices and the final exit independently. Gated CLI reports include optional JSON v1 `gate` and an equivalent human/Markdown line. Exit precedence remains error 2 (no success report), then uncertainty 3, then threshold 1, otherwise 0. Ungated scan/compare stays report-only 0 for compatibility.

**Validation gap — evaluator replay shared the production matcher.** Replay remains valuable for verifying emitted evidence, but alone cannot independently validate its own matcher. New tests calculate expected raw decisions directly from original configuration arrays with a separate dynamic-programming wildcard table and independently implemented prefix handling/precedence. They check every emitted transition witness, ten named cases and 200 deterministic policy pairs against all 1,364 nonempty strings of length 1–5 over `a`, `b`, space and `x`, for Bash and WebSearch. Repeated reports and resource-limit failures are checked for determinism. This finite corpus is additional evidence, not a formal proof of all inputs or a native provider conformance suite.

**Low — candidate branding/discoverability and rename instructions needed completion.** Current product copy now uses RuleWitness and its semantic-diff tagline, package keywords describe the actual scope, and CI is displayed as RuleWitness CI while retaining the protected `check` job identifier. The legacy executable remains a migration alias for v0.2; primary examples use `rulewitness`. Historical audits and MIT attribution remain intact. A maintainer-only rename/metadata checklist keeps current GitHub URLs valid until authorization.

No new runtime permission semantics were added. No confirmed critical correctness issue was found within the declared model during this review; untested runtime compatibility remains a limitation, not a passed check.

## Documentation verification

Current official [permissions](https://code.claude.com/docs/en/permissions) and [settings](https://code.claude.com/docs/en/settings) documentation was rechecked: deny precedes ask then allow regardless of specificity; exact Bash rules, stars and the sole trailing space-star boundary are modeled. Parameter selectors, wrappers, modes, workspace trust, runtime checks and additional settings sources remain unsupported or outside scope. Only two tracked root-level settings snapshots are inspected. Unknown settings and coverage remain visible; `complete` remains false.

Independent tests do not establish that Claude Code accepts every modeled witness or executes an ALLOW input. No installed-Claude-Code version conformance range is claimed. Existing Git-invocation, hostile-revision, decoding, symlink, inert-input, read-only-index and terminal/Markdown tests remain in place.

## Registry verification

Direct unauthenticated GETs on **2026-10-17** returned HTTP **404**, `{"error":"Not found"}`, for:

- `https://registry.npmjs.org/rulewitness`
- `https://registry.npmjs.org/%40vlovers%2Frulewitness`
- `https://registry.npmjs.org/agent-rule-witness`

`rulewitness@0.2.0` remains an unpublished candidate. These responses mean no public registry entry was returned; they neither reserve the name nor establish ownership, trademark rights or publication permission.

See [release validation and blockers](release-v0.2.0.md), [migration](migration-v0.2.md), and the [exact GitHub rename plan](github-rename.md). No publish, tag, release, merge, repository rename or settings mutation was performed.
