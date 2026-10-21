# Explicit session context (opt-in TypeScript API)

`evaluateWithContext(policy, tool, input, context)` is an additive TypeScript API for reporting the **assumptions** that separate tracked settings from a live Claude Code session. It does **not** authorize a tool, change the CLI, or change JSON schema v1.

```ts
import { parsePolicy, evaluateWithContext } from "rulewitness";

const policy = parsePolicy("HEAD", {
  ".claude/settings.json": JSON.stringify({
    permissions: { allow: ["Bash(npm test)"] },
  }),
});

const result = evaluateWithContext(policy, "Bash", "npm test", {
  projectTrust: "unknown",
  permissionMode: "unknown",
  externalInfluences: "unknown",
});

console.log(result.modeled.decision); // ALLOW: conditional rule match
console.log(result.contextual.decision); // UNKNOWN: external premises not established
console.log(result.unresolved); // all three missing premises
console.log(result.runtimeVerified); // always false
```

The caller can explicitly assert `projectTrust: "trusted"`, `permissionMode: "default"` and `externalInfluences: "none"` to obtain the underlying *modeled configured-rule decision* in `contextual`. **That remains conditional and never a verified runtime authorization verdict.** These assertions are not determined from Git and RuleWitness does not verify them.

If any premise is not affirmed, `contextual.decision` becomes `UNKNOWN` (including when the rule model reports `DENY`, `ASK`, or `ALLOW`). `modeled` always preserves the replayable configured-rule evaluation, with evidence. For a policy that already evaluates `UNKNOWN`, no context can promote it to a known decision.

This opt-in API does not claim real trust semantics for each permission category, resolve user/managed settings, interpret permission hooks, model a shell, or inspect live session grants. See [Claude runtime boundaries](claude-runtime-boundaries.md) and [official permissions documentation](https://code.claude.com/docs/en/permissions).

The existing `scanPolicy`, `comparePolicies`, `evaluate`, CLI commands and JSON report schema retain their previous behavior. Session context is not embedded into persisted reports.
