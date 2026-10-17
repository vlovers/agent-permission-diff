# npm releases with Trusted Publishing

After merging this PR, in npmjs.com open package `rulewitness` → Settings → Trusted Publishing. Choose **GitHub Actions** and enter user `vlovers`, repository `rulewitness`, workflow filename `npm-publish.yml` (not full path), and no environment. **Enable the `npm publish` allowed action**; stage-only permission is insufficient. No npm token or GitHub secret is needed. See https://docs.npmjs.com/trusted-publishers/.

For a future release:

1. Merge a passing PR that bumps both `package.json` and `package-lock.json`.
2. Tag that exact `main` commit `vX.Y.Z`.
3. Publish a GitHub Release for the tag. This triggers the OIDC workflow.
4. Confirm that Actions succeeded and verify the npm package/version.

Checks include matching version/tag, tag ancestry in main, typecheck, tests, build, consumer package smoke, format, and npm pack. Already published versions are rejected. npm generates provenance for eligible GitHub OIDC publications.

**Important:** `rulewitness@0.2.0` has already been published manually, and its GitHub Release was published before this workflow was merged. This PR performs no npm publication. Protect GitHub release/tag write permissions for maintainers.
