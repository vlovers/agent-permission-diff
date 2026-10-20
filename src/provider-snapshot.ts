import { execFileSync } from "node:child_process";
import { devNull } from "node:os";
import { readPolicy } from "./git.ts";
import { discoverProviders } from "./provider-discovery.ts";
import type { ProviderSelection } from "./provider-discovery.ts";
import type { Policy } from "./types.ts";

/**
 * Read-only, repository-root, exact-commit provider inventory.
 * The existing Claude reader remains the only semantic parser.
 * Codex configuration is detected but NEVER loaded or evaluated.
 */
export interface TrackedProviderSnapshot {
  revision: string;
  selection: ProviderSelection;
  claudePolicy: Policy | null;
}

function inspectCodexMarker(repository: string, revision: string): boolean {
  // Match the existing hardened Git reader's environment and execution flags.
  // The revision is a verified full commit ID returned by readPolicy.
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw new Error("Expected verified Git commit ID");
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
  const lsTree = (path: string): string => {
    try {
      return execFileSync(
        "git",
        [
          "--no-pager",
          "--no-optional-locks",
          "--no-lazy-fetch",
          "-C",
          repository,
          "ls-tree",
          revision,
          "--",
          path,
        ],
        {
          encoding: "utf8",
          env,
          timeout: 10_000,
          maxBuffer: 2 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ).trimEnd();
    } catch {
      throw new Error("Read-only Git provider inventory failed");
    }
  };
  const parent = lsTree(".codex");
  if (parent && !/^040000 tree [a-f0-9]+\t\.codex$/.test(parent))
    throw new Error("Unsafe .codex path: expected Git tree");
  const marker = lsTree(".codex/config.toml");
  if (!marker) return false;
  if (!/^100(644|755) blob [a-f0-9]+\t\.codex\/config\.toml$/.test(marker))
    throw new Error("Unsafe Codex config path: expected regular Git blob");
  return true;
}

/** No automatic provider selection; ambiguous/unsupported is explicit. */
export function readTrackedProviderSnapshot(
  repository: string,
  ref: string,
): TrackedProviderSnapshot {
  const policy = readPolicy(repository, ref);
  const markerPaths: string[] = policy.files.filter(
    (file) =>
      file === ".claude/settings.json" ||
      file === ".claude/settings.local.json",
  );
  if (inspectCodexMarker(repository, policy.revision))
    markerPaths.push(".codex/config.toml");
  const selection = discoverProviders(markerPaths);
  return {
    revision: policy.revision,
    selection,
    claudePolicy: selection.kind === "claude-code" ? policy : null,
  };
}
