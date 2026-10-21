// Release artifact gate: verify npm's actual tarball, not just pack --dry-run.
// Run after build; does not install, execute package code or publish.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "rulewitness-release-"));
function command(bin, args) {
  const result = spawnSync(bin, args, { encoding: "utf8", timeout: 60000 });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
try {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  assert.equal(pkg.name, "rulewitness");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  const manifest = JSON.parse(
    command("npm", [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temp,
    ]),
  )[0];
  assert.equal(manifest.name, pkg.name);
  assert.equal(manifest.version, pkg.version);
  const tarball = readFileSync(join(temp, manifest.filename));
  assert.equal(
    createHash("sha1").update(tarball).digest("hex"),
    manifest.shasum,
  );
  assert.equal(
    "sha512-" + createHash("sha512").update(tarball).digest("base64"),
    manifest.integrity,
  );
  const listed = command("tar", ["-tzf", join(temp, manifest.filename)])
    .trim()
    .split("\n")
    .map((path) => path.replace(/^package\//, ""))
    .sort();
  const declared = manifest.files.map((file) => file.path).sort();
  assert.deepEqual(
    listed,
    declared,
    "Tarball entries diverge from npm manifest",
  );
  const required = [
    "package.json",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli.js",
  ];
  for (const file of required)
    assert.ok(listed.includes(file), "Missing " + file);
  assert.ok(
    !listed.some(
      (path) =>
        /(?:^|\/)(?:src|test|node_modules|\.git|\.github)(?:\/|$)/.test(path) ||
        /(?:^|\/)(?:\.env(?:\.|$)|package-lock\.json$)/.test(path),
    ),
    "Source/test/private files leaked into tarball",
  );
  assert.deepEqual(pkg.exports, {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  });
  assert.deepEqual(pkg.bin, {
    rulewitness: "dist/cli.js",
    "agent-permission-diff": "dist/cli.js",
  });
  assert.equal(pkg.dependencies["smol-toml"], "1.9.1");
  process.stdout.write("Release artifact integrity and contents: PASS\n");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
