# Permission source provenance — experimental TypeScript API

Claude Code has managed, user, project and project-local settings as well as session state and hooks. Consult the [official settings](https://code.claude.com/docs/en/settings) and [permissions](https://code.claude.com/docs/en/permissions) references for actual precedence and applicability.

RuleWitness deliberately does **not** infer the complete effective permissions from these layers. In particular, a Git revision cannot show untracked local configuration, managed policy, current session mode, a trusted project directory, or dynamically approved tools. An absence of a Git file is not an absent runtime source.

The additive TypeScript API `inventoryPermissionSources` describes _where evidence came from_, while `comparePermissionSources` distinguishes source coverage changes from permission-rule changes. Neither API evaluates external configuration, reads the home directory or applies live setting precedence.

```ts
import {
  readPolicy,
  inventoryPermissionSources,
  comparePermissionSources,
} from "rulewitness";

const before = inventoryPermissionSources(readPolicy(process.cwd(), "HEAD~1"));
const after = inventoryPermissionSources(readPolicy(process.cwd(), "HEAD"), [
  { kind: "managed", availability: "unknown" },
  { kind: "session", availability: "present-uninspected" },
]);

const coverage = comparePermissionSources(before, after);
console.log(coverage.changes);
console.log(coverage.runtimeEquivalent); // always false
```

Every source has an explicit `availability`: `inspected` for tracked project settings parsed from the supplied Git policy, `present-uninspected` for caller-confirmed presence with no content analysis, `absent-asserted` for caller-asserted absence and `unknown` for other cases. Externally supplied facts are not verified, and a caller cannot override the presence of an inspected Git file.

This inventory does not copy configuration contents, expose secret values, query the network or invoke tools from the policy. The ordering is fixed and duplicates/invalid facts are rejected. Comparing two identical inventories yields zero _coverage changes_, **not** a runtime no-op or effective permission equivalence.

The existing Claude Code `evaluate`, `evaluateWithContext`, `comparePolicies`, scan/test CLI, severity gates and JSON schema v1 remain unchanged. To inspect configured-rule changes, use `comparePolicies` separately; do not use this provenance comparison as an authorization gate.

This is a foundation for a future versioned source-resolution design. No Codex semantic support is implied.
