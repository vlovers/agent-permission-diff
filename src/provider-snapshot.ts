import { gitEntry } from "./git-reader.ts";
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
  // Verify only Git modes; never read or execute Codex configuration.
  const parent = gitEntry(repository, revision, ".codex");
  if (parent && (parent.mode !== "040000" || parent.type !== "tree"))
    throw new Error("Unsafe .codex path: expected Git tree");
  const marker = gitEntry(repository, revision, ".codex/config.toml");
  if (!marker) return false;
  if (!["100644", "100755"].includes(marker.mode) || marker.type !== "blob")
    throw new Error("Unsafe Codex config path: expected regular Git blob");
  return true;
}

/** No automatic provider selection; ambiguous/unsupported is explicit. */
export function readTrackedProviderSnapshot(
  repository: string,
  ref: string,
): TrackedProviderSnapshot {
  const policy = readPolicy(repository, ref);
  // readPolicy records non-regular Claude paths as coverage issues. A marker
  // that is a symlink or a non-tree directory is not an absent provider.
  // Snapshot discovery must never downgrade unsafe Git objects to "absent".
  if (
    policy.issues.some(
      (issue) =>
        issue.message ===
          "Settings path is not a regular Git blob; symlinks are not followed" &&
        (issue.evidence.file === ".claude" ||
          issue.evidence.file === ".claude/settings.json" ||
          issue.evidence.file === ".claude/settings.local.json"),
    )
  )
    throw new Error("Unsafe Claude configuration path in Git revision");
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
