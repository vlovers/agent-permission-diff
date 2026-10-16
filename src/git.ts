import { execFileSync } from "node:child_process";
import { devNull } from "node:os";
import { parsePolicy, SETTINGS_FILES } from "./policy.ts";
import type { Policy } from "./types.ts";

// No shell, checkout, fetch, filters, hooks, credential helpers, or config commands.
export function readPolicy(repository: string, ref: string): Policy {
  if (
    !ref ||
    ref.startsWith("-") ||
    ref.length > 1024 ||
    /[\x00-\x1f]/.test(ref)
  )
    throw new Error("Invalid Git revision");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)),
  );
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: devNull,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_ALLOW_PROTOCOL: "",
  });
  const git = (args: string[]): string => {
    try {
      const output = execFileSync(
        "git",
        [
          "--no-pager",
          "--no-optional-locks",
          "--no-lazy-fetch",
          "-C",
          repository,
          ...args,
        ],
        {
          env,
          maxBuffer: 2 * 1024 * 1024,
          timeout: 10_000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        output,
      );
    } catch {
      throw new Error(
        `Read-only Git operation failed (${args[0]}); check revision, repository, UTF-8 input, Git --no-lazy-fetch support, and 2 MiB input limit`,
      );
    }
  };
  const root = git(["rev-parse", "--show-prefix"]);
  if (root !== "\n" && root !== "\r\n")
    throw new Error("Run from the repository root");
  const revision = git([
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw new Error("Git did not return a commit ID");
  const files: Record<string, string> = {};
  const unsafe: { file: string; fingerprint: string }[] = [];
  const parent = git(["ls-tree", revision, "--", ".claude"]);
  if (parent && !parent.startsWith("040000 tree "))
    unsafe.push({ file: ".claude", fingerprint: parent.split("\t")[0]! });
  for (const file of SETTINGS_FILES) {
    const entry = git(["ls-tree", revision, "--", file]);
    if (!entry) continue;
    if (!/^100(644|755) blob [a-f0-9]+\t/.test(entry)) {
      unsafe.push({ file, fingerprint: entry.split("\t")[0]! });
      continue;
    }
    files[file] = git(["show", `${revision}:${file}`]);
  }
  const policy = parsePolicy(revision, files);
  for (const { file, fingerprint } of unsafe) {
    policy.files.push(file);
    policy.issues.push({
      message:
        "Settings path is not a regular Git blob; symlinks are not followed",
      evidence: { revision, file, pointer: "" },
      fingerprint,
      tool: null,
    });
  }
  policy.files.sort();
  return policy;
}
