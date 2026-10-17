# RuleWitness GitHub metadata and rename plan

Prepared for the maintainer; **no repository settings or name changes have been applied**. Current location: `vlovers/agent-permission-diff`. Target after authorization: `vlovers/rulewitness`. Package candidate: `rulewitness@0.2.0`.

## Exact metadata to apply after approval

Description:

> Semantic permission diffs and policy tests for Claude Code. Explain changes, verify counterexamples, and detect permission regressions across Git revisions.

Topics:

```text
claude-code permissions security developer-tools typescript cli git-diff ai-agents static-analysis
```

Homepage: the new repository README (`https://github.com/vlovers/rulewitness#readme`) after the rename. Do not advertise an npm package homepage or version badge until publication is verified.

## Ordered rename checklist

1. Review and merge [PR #5](https://github.com/vlovers/agent-permission-diff/pull/5) through protected main after its final CI passes. Preserve history, existing tags and the required `check` job.
2. Obtain explicit owner authorization, confirm the target name is available, then rename the existing repository to **rulewitness** through GitHub **Settings → General → Repository name**. Do not create a replacement repository.
3. Verify old repository, issue, PR and commit web URLs redirect, and `git ls-remote https://github.com/vlovers/agent-permission-diff.git` still resolves. Do not reuse the old repository name: doing so breaks redirects. GitHub Pages and consumers of a hosted GitHub Action need separate review; action references do not redirect automatically.
4. Apply the exact description, topics and homepage above. Verify private vulnerability reporting, notification ownership, branch protection and required checks remain configured. These settings require maintainer action; this document does not enable them.
5. Inspect each local clone's remotes, then update only its matching origin with `git remote set-url origin https://github.com/vlovers/rulewitness.git`. Verify fetch/push URLs and branch tracking. Do not overwrite unrelated remotes or operate on other repositories automatically.
6. Update package.json's repository, homepage and bugs URLs to the new location; review the lockfile and verify tarball metadata. The npm name stays `rulewitness` subject to final availability/ownership verification.
7. Review README badges (switch the candidate branch badge to main after merge), CI links, PR/issue templates, SECURITY's private-reporting link, CONTRIBUTING, release instructions and current documentation. Preserve historical attribution and audit records. Keep the compatibility-bin migration note.
8. Run CI again after the rename; confirm required checks resolve, workflow/package smoke checks pass, redirects work, and no workflow relies on an old hosted-action path. This project currently provides a CLI/library rather than a reusable hosted Action.
9. Before separately authorized npm publication, recheck name availability, publishing rights, metadata links, package contents, version and experimental release notes against the exact reviewed commit. npm publication, tags and GitHub Releases remain separate actions requiring authorization.

Source: [GitHub's repository rename documentation](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository), reviewed 2026-10-17. GitHub's redirect behavior is not a substitute for checking actual post-rename URLs and integrations.
