import { validatePokedex } from '../src/pokedex';
import { resolve, isAbsolute } from 'node:path';
import { publicStoryFiles, parseStorySources } from '../src/story-source';
import type { StorySource } from '../src/story-source';
import { existsSync, readFileSync } from 'node:fs';
import { analyzeStory } from '../src/preflight';
import type { PreflightDiagnostic } from '../src/preflight';
import { parseStory } from '../src/story';
import type { Story } from '../src/types';

const files = process.argv.slice(2);
if (files.length === 0) files.push('content/aurelian-league/sources.json', 'src/example.story', 'examples/harbor-practice.story', 'examples/advanced-authoring.story');
const totals = { error: 0, warning: 0, information: 0 };
let checkedPublic = false;
for (const file of files) {
  const bundled = resolve(file) === resolve('content/aurelian-league/sources.json') || publicStoryFiles.some(path => resolve(path) === resolve(file));
  if (bundled && checkedPublic) continue;
  if (bundled) checkedPublic = true;
  console.log('\n' + file);
  if (!bundled && !file.endsWith('.story')) {
    console.log('  ERROR FILE_ERROR: Expected a .story filename. Action: Provide a UTF-8 .story file.');
    totals.error++;
    continue;
  }
  let source = '';
  let parts: StorySource[] = [];
  try {
    if (bundled) parts = publicStoryFiles.map(path => ({path, text: readFileSync(path, 'utf8')}));
    else source = readFileSync(file, 'utf8');
  } catch (error) {
    console.log('  ERROR FILE_ERROR: ' + (error instanceof Error ? error.message : String(error)));
    console.log('    Action: Check the filename and file permissions.');
    totals.error++;
    continue;
  }
  let story: Story;
  try { story = bundled ? parseStorySources(parts) : parseStory(source);
    const metadataPath = bundled ? 'content/aurelian-league.pokedex.json' : file.replace(/\.story$/, '.pokedex.json');
    if (existsSync(metadataPath) || story.passages.some(p => p.pokedexMarkers?.length)) validatePokedex(story, existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) : []);
  } catch (error) {
    if (error instanceof Error && 'sourcePath' in error && 'sourceMessage' in error) {
      console.log(isAbsolute(file) ? resolve(String(error.sourcePath)) : String(error.sourcePath));
      console.log('  ERROR PARSE_ERROR: ' + String(error.sourceMessage));
      console.log('    Action: Fix the reported chapter source, then rerun preflight.');
      totals.error++; continue;
    }
    console.log('  ERROR PARSE_ERROR: ' + (error instanceof Error ? error.message : String(error)));
    console.log('    Action: Fix the reported syntax or reference, then rerun preflight.');
    totals.error++;
    continue;
  }
  const report = analyzeStory(story);
  const counts = { error: 0, warning: 0, information: 0 };
  const groups = new Map<string, PreflightDiagnostic[]>();
  for (const diagnostic of report.diagnostics) {
    counts[diagnostic.severity]++;
    totals[diagnostic.severity]++;
    const key = diagnostic.passageId ?? '(story)';
    const entries = groups.get(key) ?? [];
    entries.push(diagnostic);
    groups.set(key, entries);
  }
  for (const [passage, diagnostics] of groups) {
    console.log('  ' + passage);
    for (const diagnostic of diagnostics) {
      console.log('    ' + diagnostic.severity.toUpperCase() + ' ' + diagnostic.code + ': ' + diagnostic.message);
      console.log('      Action: ' + diagnostic.action);
      if (diagnostic.route !== undefined) {
        console.log('      Route: ' + diagnostic.route.map(step =>
          (step.input === undefined ? '' : '[input_text ' + JSON.stringify(step.input) + '] -> ') + step.passageId).join(' -> '));
      }
    }
  }
  console.log('  ' + counts.error + ' errors, ' + counts.warning + ' warnings, ' + counts.information
    + ' information; ' + report.exploredRoutes + ' route prefixes replayed; '
    + report.reentryProbes + ' re-entry probes (' + report.successfulReentries + ' returns succeeded).');
}
console.log('\nTotal: ' + totals.error + ' errors, ' + totals.warning + ' warnings, ' + totals.information + ' information.');
process.exitCode = totals.error > 0 ? 1 : 0;
