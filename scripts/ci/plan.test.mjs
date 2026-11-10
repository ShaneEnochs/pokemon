import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docsOnly } from './plan.mjs';

test('only explicitly allowlisted advisory documentation is lightweight', () => {
  assert.equal(docsOnly(['README.md', 'docs/STORY_BIBLE.md']), true);
  assert.equal(docsOnly(['docs/ci-performance.md']), true);
  assert.equal(docsOnly([]), false);
  for (const path of ['docs/SCRIPTING.md', 'docs/AUTHORING.md', 'docs/ENGINE.md',
    'content/chapter.story', 'content/species.json', 'src/game.ts', 'src/style.css',
    'tests/story.test.ts', 'author-e2e/preview.spec.ts', 'playwright.config.ts',
    'package-lock.json', '.github/workflows/ci.yml', 'scripts/ci/plan.mjs',
    'images/152-chikorita.png', 'docs/new.md', 'README.md\nother', 'README.md/../src/game.ts']) {
    assert.equal(docsOnly(['README.md', path]), false, path);
  }
});

test('Git classification handles docs, moves, pushes and missing revisions safely', async () => {
  const { mkdtempSync, writeFileSync, renameSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { execFileSync, spawnSync } = await import('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'pokemon-ci-plan-'));
  const script = resolve('scripts/ci/plan.mjs');
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const commit = () => { git('add', '.'); git('-c', 'user.name=CI test', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  try {
    git('init', '-q'); writeFileSync(join(directory, 'README.md'), 'notes');
    const base = commit(); writeFileSync(join(directory, 'README.md'), 'updated notes');
    const docs = commit();
    function plan(event, head, baseSha = base) {
      const output = join(directory, 'output'); writeFileSync(output, '');
      const result = spawnSync(process.execPath, [script], { cwd: directory, env: {
        ...process.env, EVENT_NAME: event, BASE_SHA: baseSha, HEAD_SHA: head, GITHUB_OUTPUT: output,
      } });
      return { status: result.status, output: readFileSync(output, 'utf8') };
    }
    assert.deepEqual(plan('pull_request', docs), { status: 0, output: 'full=false\n' });
    assert.deepEqual(plan('push', docs), { status: 0, output: 'full=true\n' });
    assert.notEqual(plan('pull_request', docs, 'missing').status, 0);
    assert.notEqual(plan('pull_request', docs, '0'.repeat(40)).status, 0);
    renameSync(join(directory, 'README.md'), join(directory, 'source.ts')); commit();
    const sourceBase = git('rev-parse', 'HEAD');
    renameSync(join(directory, 'source.ts'), join(directory, 'README.md'));
    const moved = commit();
    assert.deepEqual(plan('pull_request', moved, sourceBase), { status: 0, output: 'full=true\n' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the required workflow gate rejects incomplete full checks and invalid docs skips', async () => {
  const { readFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const gateSection = workflow.split('      - name: Require all relevant checks\n')[1];
  const match = /        run: \|\n((?:          .*\n)+)/.exec(gateSection);
  assert.ok(match, 'Expected the actual gate shell script');
  const script = match[1].replace(/^          /gm, '');
  const cases = [
    ['true', 'success', ['success', 'success', 'success'], true],
    ['false', 'success', ['skipped', 'skipped', 'skipped'], true],
    ['true', 'success', ['success', 'failure', 'success'], false],
    ['true', 'success', ['success', 'cancelled', 'success'], false],
    ['true', 'success', ['success', 'skipped', 'success'], false],
    ['false', 'success', ['success', 'success', 'success'], false],
    ['false', 'failure', ['skipped', 'skipped', 'skipped'], false],
    ['', 'success', ['skipped', 'skipped', 'skipped'], false],
  ];
  for (const [full, plan, results, expected] of cases) {
    const result = spawnSync('bash', ['-c', script], { env: { ...process.env,
      FULL: full, PLAN_RESULT: plan, CORE_RESULT: results[0], BROWSER_RESULT: results[1], AUTHOR_RESULT: results[2],
    } });
    assert.equal(result.status === 0, expected, JSON.stringify([full, plan, results]));
  }
});
