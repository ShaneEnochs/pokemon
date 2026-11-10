import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
test('VS Code uses the custom language, discoverable command snippets, and process task arguments', () => {
  assert.equal(json('.vscode/settings.json')['files.associations']['*.story'], 'pokemon-story');
  const snippets = json('.vscode/pokemon.code-snippets');
  assert.equal(Object.keys(snippets).length, 40);
  for (const [name, value] of Object.entries(snippets)) {
    const snippet = value as { prefix: string; scope: string; body: string[] };
    assert.equal(snippet.prefix, 'pkmn-' + name);
    assert.equal(snippet.scope, 'pokemon-story,plaintext');
    assert.match(snippet.body[0]!, /^(?:\*|\\?\$|@\{|\[|#)/);
  }
  const tasks = json('.vscode/tasks.json').tasks;
  assert.deepEqual(tasks.map((task: { label: string }) => task.label), ['Aurelian League: Check Current Story', 'Aurelian League: Check Bundled Stories', 'Aurelian League: Start Local Preview']);
  assert.ok(tasks.every((task: { type: string }) => task.type === 'process'));
  assert.deepEqual(tasks[0].args, ['--import', 'tsx', 'scripts/check-stories.ts', '${file}']);
});
