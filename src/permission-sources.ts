import type { Policy } from "./types.ts";

/**
 * Source coverage is descriptive, NOT Claude Code's runtime precedence engine.
 * This type never contains raw untrusted configuration content.
 */
export type PermissionSourceKind =
  | "managed"
  | "user"
  | "project"
  | "project-local"
  | "session"
  | "hooks";

export type SourceAvailability = "inspected" | "present-uninspected" | "unknown" | "absent-asserted";

export interface PermissionSource {
  kind: PermissionSourceKind;
  availability: SourceAvailability;
}

export interface PermissionSourceInventory {
  schemaVersion: 1;
  revision: string;
  /** Git-tracked sources are discovered from the parsed policy, not from the live disk. */
  trackedFiles: readonly string[];
  /** External source facts are caller assertions, never probed or inferred. */
  sources: readonly PermissionSource[];
  /** Remains false even with caller assertions. */
  runtimeVerified: false;
}

export interface SourceCoverageChange {
  kind: PermissionSourceKind;
  before: SourceAvailability;
  after: SourceAvailability;
}

export interface SourceCoverageComparison {
  schemaVersion: 1;
  before: PermissionSourceInventory;
  after: PermissionSourceInventory;
  changes: readonly SourceCoverageChange[];
  /** Runtime equivalence cannot be established from this comparison. */
  runtimeEquivalent: false;
}

const kinds = [
  "managed",
  "user",
  "project",
  "project-local",
  "session",
  "hooks",
] as const satisfies readonly PermissionSourceKind[];

const isSource = (source: unknown): source is PermissionSource => {
  if (typeof source !== "object" || source === null || Array.isArray(source))
    return false;
  const item = source as Record<string, unknown>;
  return (
    kinds.includes(item.kind as PermissionSourceKind) &&
    ["inspected", "present-uninspected", "unknown", "absent-asserted"].includes(
      item.availability as string,
    )
  );
};

/**
 * Assemble a bounded and deterministic provenance inventory from one Git policy
 * and optional caller-provided external source facts.
 *
 * "inspected" is reserved for the tracked project configuration; user and
 * managed files are never loaded by this function.
 */
export function inventoryPermissionSources(
  policy: Policy,
  external: readonly PermissionSource[] = [],
): PermissionSourceInventory {
  if (
    !policy ||
    typeof policy.revision !== "string" ||
    !Array.isArray(policy.files) ||
    !policy.files.every((file) => typeof file === "string") ||
    !Array.isArray(external) ||
    external.length > kinds.length
  )
    throw new Error("Invalid permission source inventory input");

  const seen = new Set<PermissionSourceKind>();
  const facts = new Map<PermissionSourceKind, SourceAvailability>();
  for (const item of external) {
    if (!isSource(item) || seen.has(item.kind))
      throw new Error("Invalid or duplicate permission source fact");
    if (item.availability === "inspected")
      throw new Error("External source cannot claim to have been inspected");
    seen.add(item.kind);
    facts.set(item.kind, item.availability);
  }

  const trackedFiles = [
    ...new Set(
      policy.files.filter(
        (path) =>
          path === ".claude/settings.json" ||
          path === ".claude/settings.local.json",
      ),
    ),
  ].sort();
  for (const kind of ["project", "project-local"] as const) {
    const file =
      kind === "project" ? ".claude/settings.json" : ".claude/settings.local.json";
    const found = trackedFiles.includes(file);
    const provided = facts.get(kind);
    if (provided) {
      if (found || provided !== "unknown")
        throw new Error("Tracked source facts cannot be overridden");
    } else {
      facts.set(kind, found ? "inspected" : "unknown");
    }
  }
  return {
    schemaVersion: 1,
    revision: policy.revision,
    trackedFiles,
    sources: kinds.map((kind) => ({
      kind,
      availability: facts.get(kind) ?? "unknown",
    })),
    runtimeVerified: false,
  };
}

function checked(inventory: PermissionSourceInventory): void {
  if (
    inventory.schemaVersion !== 1 ||
    typeof inventory.revision !== "string" ||
    inventory.runtimeVerified !== false ||
    !Array.isArray(inventory.sources) ||
    inventory.sources.length !== kinds.length ||
    !kinds.every(
      (kind, i) =>
        inventory.sources[i]?.kind === kind &&
        ["inspected", "present-uninspected", "unknown", "absent-asserted"].includes(
          inventory.sources[i]!.availability,
        ),
    )
  )
    throw new Error("Invalid permission source inventory");
}

/**
 * Diff only coverage/provenance. Do not calculate precedence, merge
 * configurations or assert that two live sessions have the same rights.
 */
export function comparePermissionSources(
  before: PermissionSourceInventory,
  after: PermissionSourceInventory,
): SourceCoverageComparison {
  checked(before);
  checked(after);
  const changes = kinds.flatMap((kind, index) => {
    const left = before.sources[index]!.availability;
    const right = after.sources[index]!.availability;
    return left === right ? [] : [{ kind, before: left, after: right }];
  });
  return {
    schemaVersion: 1,
    before,
    after,
    changes,
    runtimeEquivalent: false,
  };
}
