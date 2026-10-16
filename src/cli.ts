#!/usr/bin/env node
import {
  comparePolicies,
  formatHuman,
  readPolicy,
  scanPolicy,
} from "./index.ts";

const usage =
  "Usage: agent-permission-diff scan [REV] [--json]\n       agent-permission-diff compare BEFORE AFTER [--json]\nRun at the Git repository root. Default scan revision: HEAD.";
try {
  const args = process.argv.slice(2);
  if (
    args.length === 0 ||
    (args.length === 1 && ["--help", "-h"].includes(args[0]!))
  ) {
    process.stdout.write(usage + "\n");
  } else {
    const json = args.includes("--json");
    if (args.filter((arg) => arg === "--json").length > 1)
      throw new Error(usage);
    const positional = args.filter((arg) => arg !== "--json");
    if (positional.some((arg) => arg.startsWith("-"))) throw new Error(usage);
    const [command, ...refs] = positional;
    let report;
    if (command === "scan" && refs.length <= 1)
      report = scanPolicy(readPolicy(process.cwd(), refs[0] ?? "HEAD"));
    else if (command === "compare" && refs.length === 2)
      report = comparePolicies(
        readPolicy(process.cwd(), refs[0]!),
        readPolicy(process.cwd(), refs[1]!),
      );
    else throw new Error(usage);
    process.stdout.write(
      json ? JSON.stringify(report, null, 2) + "\n" : formatHuman(report),
    );
  }
} catch (error) {
  process.stderr.write(
    `AgentPermissionDiff: ${error instanceof Error ? error.message : "Unexpected error"}\n`,
  );
  process.exitCode = 2;
}
