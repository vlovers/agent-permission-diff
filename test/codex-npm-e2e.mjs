// E2E check of the immutable npm package, not the repository build.
// Fixture commands never execute. Only isolated Git objects are inspected.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(join(tmpdir(), 'rulewitness-codex-e2e-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, `${command} ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}
function snapshot(name, config) {
  mkdirSync(join(root, '.codex'), { recursive: true });
  writeFileSync(join(root, '.codex/config.toml'), config);
  run('git', ['add', '--', '.codex/config.toml']);
  run('git', ['-c', 'user.name=RuleWitness Fixture', '-c', 'user.email=fixture@example.invalid',
    'commit', '--quiet', '-m', name]);
  return run('git', ['rev-parse', 'HEAD']);
}
function review(before, after) {
  const report = JSON.parse(run('rulewitness', ['codex-review', before, after, '--json']));
  assert.equal(report.review?.runtimeVerified, false);
  assert.equal(report.review?.runtimePermissionDiff, false);
  assert.equal(report.comparison?.runtimePermissionDiff, false);
  return report;
}
try {
  run('git', ['init', '--quiet']);
  const baseline = snapshot('baseline', 'approval_policy = "on-request"\nsandbox_mode = "read-only"\n');
  const broadening = snapshot('broaden', 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n');
  const unchanged = review(baseline, baseline);
  assert.equal(unchanged.comparison.posture.changes.length, 0);
  assert.equal(unchanged.review.direction, 'unchanged');
  assert.equal(unchanged.comparison.uncertain, false);

  const changed = review(baseline, broadening);
  assert.ok(changed.comparison.posture.changes.length > 0);
  assert.notEqual(changed.review.direction, 'unchanged');

  // Unknown syntax must not be silently classified as safe or as an unchanged policy.
  const unsupported = snapshot('unsupported', 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n[profiles.experimental]\nfoo = "bar"\n');
  const unknown = review(broadening, unsupported);
  assert.equal(unknown.comparison.uncertain, true);
  assert.ok(unknown.review.unresolved.length > 0 || unknown.review.direction === 'unknown');

  process.stdout.write('npm Codex E2E: unchanged, configured change, and uncertainty PASS\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### Published RuleWitness Codex E2E\n' +
      '- npm: pinned 0.4.0-rc.2 (no PR install scripts)\n' +
      '- Exact Git commits: unchanged / changed / unsupported all passed\n' +
      '- Runtime permissions: **not verified**\n');
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
