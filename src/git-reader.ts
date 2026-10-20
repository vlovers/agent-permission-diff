import { execFileSync } from "node:child_process";
import { devNull } from "node:os";

const MAX_BUFFER = 2 * 1024 * 1024;

/**
 * Fixed-argument, read-only Git runner shared across provider readers.
 * Untrusted trees never supply subprocess arguments or environment settings.
 */
export function readOnlyGit(
  repository: string,
  args: readonly string[],
): string {
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
        maxBuffer: MAX_BUFFER,
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
}

/** A file's tree metadata is inert; symlinks/submodules must never be opened. */
export function gitEntry(
  repository: string,
  revision: string,
  path: string,
): { mode: string; type: string; oid: string } | null {
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw new Error("Expected verified Git commit ID");
  const output = readOnlyGit(repository, ["ls-tree", revision, "--", path]);
  if (!output) return null;
  const match =
    /^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40,64})\t([^\r\n]+)\r?\n?$/.exec(
      output,
    );
  if (!match || match[4] !== path) throw new Error("Unexpected Git tree entry");
  return { mode: match[1]!, type: match[2]!, oid: match[3]! };
}
