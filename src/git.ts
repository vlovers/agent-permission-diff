import { parsePolicy, SETTINGS_FILES } from "./policy.ts";
import { gitEntry, readOnlyGit } from "./git-reader.ts";
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
  const root = readOnlyGit(repository, ["rev-parse", "--show-prefix"]);
  if (root !== "\n" && root !== "\r\n")
    throw new Error("Run from the repository root");
  const revision = readOnlyGit(repository, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw new Error("Git did not return a commit ID");
  const files: Record<string, string> = {};
  const unsafe: { file: string; fingerprint: string }[] = [];
  const parent = gitEntry(repository, revision, ".claude");
  if (parent && (parent.mode !== "040000" || parent.type !== "tree"))
    unsafe.push({ file: ".claude", fingerprint: parent.mode + " " + parent.type + " " + parent.oid });
  for (const file of SETTINGS_FILES) {
    const entry = gitEntry(repository, revision, file);
    if (!entry) continue;
    if (!["100644", "100755"].includes(entry.mode) || entry.type !== "blob") {
      unsafe.push({ file, fingerprint: entry.mode + " " + entry.type + " " + entry.oid });
      continue;
    }
    files[file] = readOnlyGit(repository, ["show", `${revision}:${file}`]);
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
