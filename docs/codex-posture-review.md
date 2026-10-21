# Experimental Codex configured-posture review

The opt-in `reviewCodexPosture(before, after)` and `reviewTrackedCodexPosture(repository, beforeRef, afterRef)` APIs classify **explicit configuration changes**. No result is an effective permission decision or a verified Codex runtime grant. `runtimePermissionDiff` and `runtimeVerified` remain `false`.

From the repository root:

```sh
rulewitness codex-review HEAD~1 HEAD --json
```

The JSON result combines exact-Git posture comparison with a conditional `review.direction`. Supported directions are `broader-configured-sandbox`, `narrower-configured-sandbox`, `fewer-approval-prompts`, `more-approval-prompts`, `mixed`, `unchanged`, and `unknown`.

The review only orders explicitly configured `read-only`, `workspace-write`, `danger-full-access` modes. It treats `on-request` to `never` as **fewer prompts**, not proof of an authorization escalation. An explicit network flag transition is only classified when both snapshots explicitly use `workspace-write`. Missing approval/sandbox flags, missing workspace network flags in that mode, unsupported config, or changes to platform-dependent temporary-root exclusions produce `unknown`.

The labels describe a **configuration posture comparison**, not runtime capabilities: user and managed settings, profile selection, trust, sandbox platform implementations, privileged tools, network filtering and runtime approvals may override the tracked project configuration. Neither a known direction nor `unchanged` establishes effective-permission equivalence. Do not use this API as an authorization gate.

See [Codex posture boundaries](codex-posture-experimental.md) and [official Codex configuration basics](https://developers.openai.com/codex/config-basic).
