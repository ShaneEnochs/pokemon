import configuredFiles from '../content/aurelian-league/sources.json' with { type: 'json' };
import { parseStory } from './story';
export { parseStory } from './story';

/** The public story's single explicit order, shared by browser, CLI and tools. */
export const publicStoryFiles: readonly string[] = Object.freeze([...configuredFiles]);
export interface StorySource { readonly path: string; readonly text: string; }
const normalized = (text: string) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

export function assembleStorySources(parts: readonly StorySource[]): string {
  return parts.map(part => normalized(part.text)).join('\n');
}

/** Keep the existing parser and translate only its source-line diagnostics. */
export function parseStorySources(parts: readonly StorySource[]) {
  try { return parseStory(assembleStorySources(parts)); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = /^Line (\d+)/.exec(message);
    if (!match) throw error;
    let line = Number(match[1]);
    for (const part of parts) {
      const lines = normalized(part.text).split('\n').length;
      if (line <= lines) {
        const sourceMessage = message.replace(/^Line \d+/, 'Line ' + line);
        throw Object.assign(new Error(`${part.path}: ${sourceMessage}`), {
          sourcePath: part.path, sourceLine: line, sourceMessage,
        });
      }
      line -= lines; // One separator newline after the previous last line.
    }
    throw error;
  }
}

export { validatePokedex } from './pokedex';
