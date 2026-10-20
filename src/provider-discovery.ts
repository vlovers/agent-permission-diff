/**
 * Read-only provider file inventory. The caller supplies Git tree paths;
 * this module neither reads files nor grants support for another provider.
 * It must never be used as a runtime authorization or automatic selection API.
 */
export const PROVIDER_MARKERS = {
  "claude-code": [".claude/settings.json", ".claude/settings.local.json"],
  codex: [".codex/config.toml"],
} as const;

export type CandidateProvider = keyof typeof PROVIDER_MARKERS;
export type ProviderSelection =
  | { kind: "claude-code"; files: string[] }
  | { kind: "unsupported"; provider: "codex"; files: string[] }
  | { kind: "ambiguous"; providers: CandidateProvider[]; files: string[] }
  | { kind: "absent"; files: [] };

const MAX_PATHS = 4096;
const MAX_PATH_LENGTH = 1024;

function validPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= MAX_PATH_LENGTH &&
    !path.startsWith("/") &&
    !path.startsWith("./") &&
    !path.includes("\\") &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    path
      .split("/")
      .every((part) => part.length > 0 && part !== "." && part !== "..")
  );
}

/**
 * Presence means only that a path matched a known location.
 * Content, symlinks, Git modes, trust, ancestor layers, and real applicability
 * remain unverified. Never silently prefer Claude over another provider.
 */
export function discoverProviders(paths: Iterable<string>): ProviderSelection {
  const seen = new Set<string>();
  let emitted = 0;
  for (const path of paths) {
    if (++emitted > MAX_PATHS)
      throw new Error("Provider path inventory limit exceeded");
    if (!validPath(path)) throw new Error("Invalid provider inventory path");
    seen.add(path);
  }
  const providers = (
    Object.keys(PROVIDER_MARKERS) as CandidateProvider[]
  ).filter((provider) =>
    PROVIDER_MARKERS[provider].some((marker) => seen.has(marker)),
  );
  const files = providers
    .flatMap((provider) =>
      PROVIDER_MARKERS[provider].filter((marker) => seen.has(marker)),
    )
    .sort();
  if (providers.length > 1) return { kind: "ambiguous", providers, files };
  if (providers[0] === "codex")
    return { kind: "unsupported", provider: "codex", files };
  if (providers[0] === "claude-code") return { kind: "claude-code", files };
  return { kind: "absent", files: [] };
}

/**
 * This helper is deliberately strict. Future implementations need a separate
 * audited provider-specific loader, not a generic "auto" interpretation.
 */
export function requireClaudeProjectFiles(
  inventory: ProviderSelection,
): string[] {
  if (inventory.kind !== "claude-code")
    throw new Error(
      inventory.kind === "ambiguous"
        ? "Ambiguous provider inventory; choose an explicit provider"
        : inventory.kind === "unsupported"
          ? "Codex configuration detected but semantic support is unavailable"
          : "No supported project provider configuration detected",
    );
  return [...inventory.files];
}
