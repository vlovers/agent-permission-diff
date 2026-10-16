# Research notes

Reviewed 2026-10-16. Documentation evolves independently of this project; this MVP models only the subset listed in the README. It has not been validated against a running Claude Code installation and does not pin a compatible Claude Code release range.

## Primary documentation

- [Claude Code permissions](https://code.claude.com/docs/en/permissions): documents deny/ask/allow ordering, tool/specifier rules, Bash wildcard boundaries and the legacy prefix suffix. It also describes shell parsing, wrapper removal, built-in read-only approvals, modes, path protections, MCP and hooks. These extra runtime layers motivate explicit unknowns rather than assuming every unmatched request prompts.
- [Settings files and precedence](https://code.claude.com/docs/en/settings): identifies shared and local project settings, external higher-precedence sources, list merging, and invalid-settings recovery. This implementation merges tracked project permission lists and treats malformed input conservatively. It does not attempt to discover machine-wide effective settings.

## Related open-source tools

Descriptions below reflect the linked projects' own READMEs, not an exhaustive competitive survey or independent verification of their claims.

| Tool                                                    | Documented focus                                                                        | AgentPermissionDiff's chosen scope                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [GrantGuard](https://github.com/OpenVanta/GrantGuard)   | Audits accumulated standing permissions and helps review/clean them                     | Compares the configured decisions between commits; no cleanup or mutation |
| [clauditor](https://github.com/gabrielsoltz/clauditor)  | Security scanning of Claude Code configuration, including hooks and permissive settings | Small, deterministic rule-policy comparison with explicit coverage gaps   |
| [polycheck](https://github.com/cognitive-fab/polycheck) | Least-privilege policy analysis and credential-egress reachability witnesses            | Decision changes and evidence; no credential/egress model                 |

## Design consequences

1. Text changes are insufficient: a deny can mask an added allow, and two different wildcard spellings can describe the same grant.
2. Symbolic glob comparison avoids a hardcoded command sample list. It is exact for the supported raw matching layer, not for shell execution semantics.
3. Unsupported semantics require visible coverage findings, including changes that cannot be assigned a concrete before/after runtime decision.
4. The analyzer must never load hooks or run commands from its inputs. Revisions are read as data with fixed Git operations.
5. A partial report must never be presented as a full runtime security approval.
