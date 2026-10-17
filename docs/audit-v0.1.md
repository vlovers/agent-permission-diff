# v0.1 correctness and security audit

Historical AgentPermissionDiff audit, retained as evidence of the project's evolution into RuleWitness. Current candidate details are in [the v0.2 release notes](release-v0.2.0.md); this document's test counts and output descriptions refer to v0.1.

Audit target: `658f7d133b973ed733317a7ecd866ecc77df7405`. Reviewed 2026-10-16 from a clean checkout, by re-reading the implementation and current primary documentation, constructing failing regressions, and testing the fixes. This is a separate audit pass by the same coding assistant, not third-party certification or a live Claude Code conformance test. No analyzed command, credential, paid AI service, or telemetry was used. Work and fixture repositories stayed inside AgentPermissionDiff.

## Documentation verification

| Topic                      | Official reference                                                                                                                                                                                                               | Assessment                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule precedence            | [Manage permissions](https://code.claude.com/docs/en/permissions#manage-permissions)                                                                                                                                             | Deny before ask before allow, independent of specificity; implemented for the supported subset                                                                     |
| Exact and wildcard rules   | [Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)                                                                                                                                               | Whole-text matching, stars including spaces, bare-prefix exception for a sole trailing space-star, legacy suffix; table-driven tests match the documented examples |
| Scalar parameter matching  | [Match by input parameter](https://code.claude.com/docs/en/permissions#match-by-input-parameter)                                                                                                                                 | Ask/deny selectors are separate semantics; ambiguous single-identifier colon forms now stay unknown before legacy normalization                                    |
| Runtime shell processing   | [Bash](https://code.claude.com/docs/en/permissions#bash)                                                                                                                                                                         | Compound parsing, wrapper removal, assignments, exact-only exec/find approvals, redirections and built-in approvals are not equivalent to raw glob matching        |
| Source hierarchy and lists | [Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence), [list merging](https://code.claude.com/docs/en/settings#lists-merge-instead-of-overriding)                                                  | Permission arrays combine. The two tracked files are only a project snapshot; managed, CLI, user and session sources remain outside scope                          |
| Repository/local discovery | [Local file in Git](https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository), [workspace trust](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust) | Primary working directory, main-checkout worktree behavior, platform/ownership exceptions and tracked-local trust must not be inferred from this snapshot          |
| Invalid settings           | [Broken settings](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)                                                                                                                                           | Provider recovery can skip files or values; this analyzer conservatively uses unknowns instead of emulating recovery                                               |
| Git argument safety        | [rev-parse](https://git-scm.com/docs/git-rev-parse), [Git options and environment](https://git-scm.com/docs/git)                                                                                                                 | Argv invocation, end-of-options, resolved commit IDs, no lazy fetching, protocol blocking and environment scrubbing are used                                       |

## Findings ranked by severity

Audit severity describes analyzer correctness/security impact. It is separate from the CLI's permission-transition severity table. Runtime examples below are documented behavior, not experiments executing Claude Code.

### High — A1: stable UNKNOWN settings suppressed changed rules

Before and after could both contain the same unsupported hook, while changing `deny: ["Bash"]` to `allow: ["Bash"]`. Both evaluated to unknown and the unchanged issue fingerprints caused **zero findings**. A hook that did not affect the request would still leave a real permission change. The report could incorrectly suggest unchanged effective policy.

Fix: changed normalized supported rule sets under relevant unresolved configuration produce a coverage finding with unknown decisions and both issue/rule evidence. No unknown is promoted to a known decision. Duplicates and reordering of the same normalized rules remain ignored. Coverage findings can intentionally be conservative about redundant rules under unknowns. Human reports no longer assert unchanged policy when no changes were established.

### High — A2: parameter wildcard rules became command prefixes

`Bash(run_in_background:*)` was normalized into `Bash(run_in_background *)`. Replacing the former with the latter could produce no finding even though a scalar parameter selector and a command prefix govern different requests.

Fix: detect ambiguity before normalization. Single-identifier colon forms in ask/deny remain unknown, including future parameter names, rather than maintaining an incomplete parameter-name list. This explicitly narrows legacy support: use space-separated command prefixes there. Allow-list legacy suffixes and multiword command prefixes are retained.

### Medium — A3: unsupported fingerprints had encoding collisions

Distinct JSON types could have identical pre-hash strings: `{ "a": 1 }` and `[["a", "1"]]`, as well as `{}` and `[]`. This was a canonicalization collision, not a SHA-256 break. Unsupported changes could disappear. Separately, removing every final numeric JSON-pointer component could conflate unrelated unknown property names.

Fix: type-preserving sorted-object encoding, ordered arrays, explicit overflow/signed-zero number representations, and index normalization restricted to permission rule arrays. The adversarial value table tests 16 distinct values and all 120 unordered pairs, with a separate numeric overflow/null/zero regression. Fingerprints remain opaque diagnostics and are not stable across analyzer versions.

### Medium — A4: runtime-sensitive patterns could hide exact grants

Raw glob inclusion is insufficient for exec wrappers and `find`. For example, adding an exact approval below `Bash(watch *)` appeared redundant, although the official docs describe invocations a wildcard prefix cannot approve and an exact rule can. Wrapper removal also makes literal wrapper rules unreliable under the raw model.

Fix: literal wrapper/find forms now cause unknown coverage. Adding an exact rule beneath an unchanged unresolved rule is visible through A1. This is conservative narrowing, not implementation of wrapper semantics. Broad/leading wildcards can still cover such inputs; therefore the rule-layer API remains unsuitable for runtime authorization and full-runtime claims remain blocked.

### Medium — A5: silently ignored fields bypassed invalid-settings uncertainty

`model` and `effortLevel` were ignored regardless of type. Unsupported or schema-invalid values could change provider loading/recovery while the analyzer reported the same rules. Only the manual-mode analytical assumption justified ignoring valid values; it did not validate whole-file recovery.

Fix: both fields now produce explicit global unknown coverage, as do non-string `$schema` values. String `$schema` metadata remains ignored. No provider schema or invalid-file recovery is inferred.

### Medium — A6: Git safety and data fidelity needed fail-closed behavior

The reader relied on an environment variable for no-lazy-fetch behavior, without requiring a Git implementation that honored it. Older versions could silently ignore the variable. UTF-8 decoding also replaced malformed bytes, conflating distinct raw blobs. No remote execution or network access was observed during this audit.

Fix: require the `--no-lazy-fetch` option, deny every transport with `GIT_ALLOW_PROTOCOL`, and strictly decode UTF-8. An old-Git stub proves unsupported options fail before a report is emitted. Invalid byte fixtures now fail with exit 2; BOMs are preserved and stay conservatively invalid JSON. Git variables are scrubbed case-insensitively. Root detection checks raw prefix output instead of whitespace normalization. The Git executable and repository metadata remain trusted inputs, not a sandbox boundary.

### Low — A7: resource bounds and library terminal output gaps

State count alone did not bound work spent traversing large active NFA sets. Unsupported nesting could exhaust the call stack. Caller-supplied library revision labels were printed without terminal escaping even though configuration strings were escaped.

Fix: add a symbolic work budget, library input-size and unsupported-value depth limits, and escape revision labels in every human-report location. Human quoting also escapes C1, Unicode format/bidirectional controls and Unicode line separators, beyond JSON's usual C0 escaping. Limits throw explicitly and the CLI emits exit 2 without partial JSON. These measures are not a hard process memory/time sandbox.

## Additional reviewed behavior

- Git calls are fixed `execFileSync` argv operations, with no shell. Revisions beginning with options, containing controls/NULs, exceeding limits, or resolving to non-commits fail. Shell-looking revision strings remain data. Tags and ordinary commit expressions resolve normally.
- Only two fixed settings paths are read as regular blobs. Symlinks and nonregular parents become coverage issues. Dirty files, the index and HEAD are preserved. Replacement refs and inherited Git repository/index/trace variables are disabled. Missing/promisor objects must fail rather than invoke a transport.
- The product NFA is correct for its declared nonempty raw glob input language in the tested cases. An independent regex/recursive oracle, 36 generated pattern pairs, and 100 seeded policy pairs exercise short-string acceptance signatures, decision transitions, witness replay and self-comparisons. This is strong regression evidence, not a formal proof of the implementation or of Claude Code behavior.
- JSON `schemaVersion: 1`, field shapes, enums and `complete: false` are retained. Structural, round-trip and determinism tests were added. Diagnostic strings/fingerprints/witness ordering are not promised stable between versions. Reports cannot be treated as validated policy-import documents.
- Exit 0 means report generation, including findings and incomplete coverage. Exit 2 means a failure. There is deliberately no severity-based gate; security-sensitive consumers must inspect the report. Error cases have empty stdout. No silent `UNKNOWN → ALLOW` conversion was introduced.

## Tests and validation

The original 10 tests are retained. The audit adds 18 tests, for **28 passing tests** total: unknown-masking regressions, typed fingerprint/pointer/numeric-overflow cases, parameter ambiguity, malformed rule boundaries, runtime-sensitive narrowing, unsupported fields, official matching examples, generated symbolic/policy properties, JSON stability, terminal escaping, analysis budgets, hostile revisions, environment isolation, old Git, invalid UTF-8/BOM, CLI parsing and failure output.

Validation passed: typecheck, all 28 tests, formatting checks, build, built-package export/unknown-regression smoke checks, and CLI JSON output. CI is configured but has not run remotely. Tests do not invoke Claude Code, execute analyzed settings, contact remotes or use credentials.

## Unsupported behavior and release blockers

1. **Full runtime permission claims remain blocked.** Bash compounds, normalization/wrappers, quoting, substitutions, redirect/file checks, built-in approvals, sessions, modes beyond the fixed manual assumption, hooks, sandboxing, other tools and external settings are not modeled. Even `evaluate()` can return a configured allow for text that the runtime would split or block. It is a rule-layer API, never an enforcement API. These limitations can cause runtime false positives and false negatives without changing the tracked raw rule language.
2. **Provider compatibility remains unverified.** Establish a supported Claude Code version range and safe native conformance fixtures before advertising runtime compatibility. Documentation review is insufficient to certify installed behavior.
3. **Runtime source discovery remains outside scope.** Worktree/main-checkout local files, untracked local files, nested/primary-working-directory settings, workspace trust, platform/ownership exceptions, managed/user/CLI/session inputs and files outside the two allowlisted paths can change behavior without a finding. Windows execution/symlink behavior has not been validated.
4. **Release readiness:** a private security contact/reporting channel is still absent. Establish it before inviting public vulnerability disclosures. Registry publication, pushing and hosting remain separate actions requiring approval.

The fixes make the narrow, experimental rule-policy comparator more conservative and prevent the reproduced false-clean reports. They do not turn it into a complete runtime permission audit.
