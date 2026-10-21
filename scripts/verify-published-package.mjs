// Read-only post-publication npm metadata checks.
export function verifyPublishedPackage(pkg, tags, metadata) {
  if (pkg?.name !== "rulewitness" || metadata?.name !== pkg.name || metadata.version !== pkg.version) throw new Error("Published package name/version mismatch");
  const tag = pkg.version.includes("-") ? "next" : "latest";
  if (tags?.[tag] !== pkg.version) throw new Error("Published dist-tag mismatch");
  if (tag === "next" && (!/^\d+\.\d+\.\d+$/.test(tags.latest) || tags.latest === pkg.version)) throw new Error("Prerelease replaced stable latest");
  if (typeof metadata.dist?.integrity !== "string" || !metadata.dist.integrity.startsWith("sha512-")) throw new Error("Missing npm integrity");
  if (metadata.bin?.rulewitness !== "dist/cli.js" || metadata.bin?.["agent-permission-diff"] !== "dist/cli.js") throw new Error("Missing published CLI aliases");
  return { version: pkg.version, tag, latest: tags.latest };
}
