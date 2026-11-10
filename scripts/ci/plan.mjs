import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Deliberately narrow: SCRIPTING.md is executable input to grammar tests.
const advisoryDocs = new Set([
  'README.md', 'FUTURE_IDEAS.md', 'docs/STORY_BIBLE.md',
  'docs/STORY_OUTLINE.md', 'docs/CHARACTERS.md', 'docs/ci-performance.md',
]);
export function docsOnly(paths) {
  return paths.length > 0 && paths.every(path => advisoryDocs.has(path));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let lightweight = false;
  if (process.env.EVENT_NAME === 'pull_request') {
    const { BASE_SHA, HEAD_SHA } = process.env;
    if (![BASE_SHA, HEAD_SHA].every(sha => /^[a-f0-9]{40}$/.test(sha ?? ''))) throw Error('Missing PR commit IDs');
    // Disable rename detection so both sides of a move are checked. NUL handles unusual names.
    const names = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', BASE_SHA, HEAD_SHA], { encoding: 'utf8' });
    lightweight = docsOnly(names.split('\0').filter(Boolean));
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `full=${!lightweight}\n`);
  console.log(lightweight ? 'Advisory documentation only; browser/build checks are not relevant.' : 'Full validation required.');
}
