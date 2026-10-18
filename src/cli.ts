#!/usr/bin/env node
import {
  comparePolicies,
  assessComparisonGate,
  formatHuman,
  formatMarkdown,
  formatPullRequestMarkdown,
  readPolicy,
  readTestConfig,
  runPolicyTests,
  scanPolicy,
} from "./index.ts";
import { safeText } from "./report.ts";
import type { PolicyTestReport, Report, SeverityThreshold } from "./types.ts";

const usage = `Usage: rulewitness scan [REV] [--json|--markdown]
       rulewitness compare BEFORE AFTER [--json|--markdown|--pr-markdown] [--fail-on high|medium|low|info]
       rulewitness test [--config rulewitness.tests.json] [--rev HEAD] [--json|--markdown]
Run at the Git repository root. Default scan/test revision: HEAD.
Compatibility bin: agent-permission-diff (same commands and output).
Exit codes: 0 report/pass; 1 threshold/assertion failure; 2 analysis/usage error; 3 uncertain severity gate.
All results concern supported configured-rule semantics, not runtime authorization.`;

try {
  const args = process.argv.slice(2);
  if (
    !args.length ||
    (args.length === 1 && ["--help", "-h"].includes(args[0]!))
  ) {
    process.stdout.write(usage + "\n");
  } else {
    const [command, ...rest] = args;
    if (!["scan", "compare", "test"].includes(command!)) throw new Error(usage);
    const refs: string[] = [];
    const options = new Map<string, string>();
    let format: "human" | "json" | "markdown" | "pr-markdown" = "human";
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i]!;
      if (arg === "--json" || arg === "--markdown" || arg === "--pr-markdown") {
        if (format !== "human")
          throw new Error("Choose exactly one output format");
        format =
          arg === "--json"
            ? "json"
            : arg === "--pr-markdown"
              ? "pr-markdown"
              : "markdown";
      } else if (["--config", "--rev", "--fail-on"].includes(arg)) {
        const value = rest[++i];
        if (options.has(arg) || !value || value.startsWith("-"))
          throw new Error(`Invalid or repeated ${arg}`);
        options.set(arg, value);
      } else if (arg.startsWith("-")) throw new Error(usage);
      else refs.push(arg);
    }
    if (
      (command !== "test" &&
        (options.has("--config") || options.has("--rev"))) ||
      (command !== "compare" && options.has("--fail-on"))
    )
      throw new Error(usage);
    const threshold = options.get("--fail-on");
    if (threshold && !["high", "medium", "low", "info"].includes(threshold))
      throw new Error("Invalid severity threshold");
    if (format === "pr-markdown" && command !== "compare")
      throw new Error("--pr-markdown applies only to compare");
    let report: Report | PolicyTestReport;
    if (command === "scan" && refs.length <= 1) {
      report = scanPolicy(readPolicy(process.cwd(), refs[0] ?? "HEAD"));
    } else if (command === "compare" && refs.length === 2) {
      report = comparePolicies(
        readPolicy(process.cwd(), refs[0]!),
        readPolicy(process.cwd(), refs[1]!),
      );
      if (threshold) {
        report.gate = assessComparisonGate(
          report,
          threshold as SeverityThreshold,
        );
        process.exitCode = report.gate.exitCode;
      }
    } else if (command === "test" && refs.length === 0) {
      const policy = readPolicy(process.cwd(), options.get("--rev") ?? "HEAD");
      report = runPolicyTests(
        policy,
        readTestConfig(process.cwd(), options.get("--config")),
      );
      process.exitCode = report.passed ? 0 : 1;
    } else throw new Error(usage);
    process.stdout.write(
      format === "json"
        ? JSON.stringify(report, null, 2) + "\n"
        : format === "markdown"
          ? formatMarkdown(report)
          : format === "pr-markdown"
            ? formatPullRequestMarkdown(report as Report)
            : formatHuman(report),
    );
  }
} catch (error) {
  process.stderr.write(
    `RuleWitness: ${safeText(error instanceof Error ? error.message : "Unexpected error")}\n`,
  );
  process.exitCode = 2;
}
