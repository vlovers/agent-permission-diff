# Source-aware evaluation: conservative integration

`evaluateWithSources(policy, tool, input, context, externalSources?)` combines the opt-in source provenance inventory with explicit session assumptions. It does **not** merge Claude Code settings or resolve full runtime precedence. It performs no filesystem, Git, network or shell operations.

```ts
import { readPolicy, evaluateWithSources } from "rulewitness";

const policy = readPolicy(process.cwd(), "HEAD");
const result = evaluateWithSources(policy, "Bash", "npm test", {
  projectTrust: "trusted",
  permissionMode: "default",
  externalInfluences: "none",
});
console.log(result.modeled.decision); // conditional tracked-rule decision
console.log(result.contextual.decision); // UNKNOWN: external sources unresolved
console.log(result.unresolvedSources); // e.g. managed, user, project-local, session, hooks
console.log(result.runtimeVerified); // always false
```

The function returns:

- `modeled`: unchanged configured-rule decision from `evaluate()`.
- `contextual`: `UNKNOWN` whenever a required session premise or source is uninspected; otherwise the *same conditional modeled decision*, **never an actual runtime authorization verdict**.
- `unresolved`: context dimensions that were not asserted.
- `unresolvedSources`: source layers with `unknown` or `present-uninspected` availability.
- `inventory`: bounded provenance information, no raw configuration values.
- `runtimeVerified: false`: invariant even with all asserted premises.

The caller may assert `absent-asserted` for managed/user/session/hooks, but such facts are not verified. Untracked project-local configuration remains `unknown` even when missing from Git. A tracked project file is marked `inspected` only in the *source inventory* sense; there is still no runtime validation or trust proof.

This model intentionally fails closed for missing context rather than declaring an effective permission expansion. It never changes `scan`, `compare`, `test`, CLI exit statuses or report JSON v1. Do not use this output as an authorization gate. See [permission-source provenance](permission-source-provenance.md) and [Claude runtime boundaries](claude-runtime-boundaries.md).

Primary upstream reference: [Claude Code settings](https://code.claude.com/docs/en/settings) and [permissions](https://code.claude.com/docs/en/permissions).
