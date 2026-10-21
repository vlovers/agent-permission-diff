import { gitEntry, readOnlyGit } from "./git-reader.ts";
import { compareCodexPosture, inspectCodexPosture } from "./codex-posture.ts";
import type { CodexPosture, CodexPostureComparison } from "./codex-posture.ts";

export interface TrackedCodexPosture {
  revision: string;
  path: ".codex/config.toml";
  present: boolean;
  posture: CodexPosture;
}

export interface TrackedCodexPostureComparison {
  schemaVersion: 1;
  provider: "codex";
  scope: "tracked-project-config-posture";
  before: TrackedCodexPosture;
  after: TrackedCodexPosture;
  posture: CodexPostureComparison;
  uncertain: boolean;
  runtimePermissionDiff: false;
}

const path = ".codex/config.toml" as const;
const MAX_CONFIG_BYTES = 64 * 1024;

/**
 * Reads only one regular blob at an exact existing commit, without checkout,
 * fetching, reading a symlink, running filters or evaluating configuration.
 */
export function readTrackedCodexPosture(
  repository: string,
  ref: string,
): TrackedCodexPosture {
  if (
    !ref ||
    ref.startsWith("-") ||
    ref.length > 1024 ||
    /[\x00-\x1f]/.test(ref)
  )
    throw new Error("Invalid Git revision");
  const prefix = readOnlyGit(repository, ["rev-parse", "--show-prefix"]);
  if (prefix !== "\n" && prefix !== "\r\n")
    throw new Error("Run from the repository root");
  const revision = readOnlyGit(repository, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  if (!/^[0-9a-f]{40,64}$/.test(revision))
    throw new Error("Git did not return a commit ID");
  const parent = gitEntry(repository, revision, ".codex");
  if (parent && (parent.mode !== "040000" || parent.type !== "tree"))
    throw new Error("Unsafe Codex configuration directory");
  const entry = gitEntry(repository, revision, path);
  if (!entry)
    return {
      revision,
      path,
      present: false,
      posture: {
        ...inspectCodexPosture(""),
        issues: [
          "No tracked Codex project configuration; runtime state unknown",
        ],
      },
    };
  if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode))
    throw new Error("Unsafe Codex configuration: expected regular Git blob");
  const sizeText = readOnlyGit(repository, [
    "cat-file",
    "-s",
    entry.oid,
  ]).trim();
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_CONFIG_BYTES)
    throw new Error("Codex configuration exceeds 64 KiB limit");
  const content = readOnlyGit(repository, ["show", `${revision}:${path}`]);
  return {
    revision,
    path,
    present: true,
    posture: inspectCodexPosture(content),
  };
}

export function compareTrackedCodexPosture(
  repository: string,
  beforeRef: string,
  afterRef: string,
): TrackedCodexPostureComparison {
  const before = readTrackedCodexPosture(repository, beforeRef);
  const after = readTrackedCodexPosture(repository, afterRef);
  const posture = compareCodexPosture(before.posture, after.posture);
  return {
    schemaVersion: 1,
    provider: "codex",
    scope: "tracked-project-config-posture",
    before,
    after,
    posture,
    uncertain: posture.uncertain || !before.present || !after.present,
    runtimePermissionDiff: false,
  };
}
