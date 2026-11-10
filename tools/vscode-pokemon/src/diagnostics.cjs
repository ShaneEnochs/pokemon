const { parseStory, parseStorySources, publicStoryFiles, validatePokedex } = require('../dist/parser.cjs');
const fs = require('node:fs');
const path = require('node:path');
function problem(text, lineCount, metadata) {
  try { const story = parseStory(text); if (metadata !== undefined || story.passages.some(p => p.pokedexMarkers?.length)) validatePokedex(story, metadata ?? []); return undefined; }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = /^Line ([1-9]\d*)(?:, passage "[^"]+")?: /.exec(message);
    const line = match ? Number(match[1]) - 1 : undefined;
    return { message, line: line !== undefined && line < lineCount ? line : undefined };
  }
}
// Fixed public source list only; other .story documents retain standalone validation.
function chapterProblem(filename, text, documents = []) {
  if (!filename) return undefined;
  const relative = publicStoryFiles.find(file => filename.endsWith(path.sep + file.split('/').join(path.sep)));
  if (!relative) return undefined;
  const root = filename.slice(0, -relative.length);
  const files = publicStoryFiles.map(file => path.resolve(root, file));
  let parts;
  try {
    parts = files.map(file => ({path: file, text: file === filename ? text
      : documents.find(document => document.uri.fsPath === file)?.getText() ?? fs.readFileSync(file, 'utf8')}));
    const story = parseStorySources(parts);
    const metadataPath = path.resolve(root, "content/aurelian-league.pokedex.json");
    if (fs.existsSync(metadataPath)) validatePokedex(story, JSON.parse(fs.readFileSync(metadataPath, "utf8")));
    return { files };
  } catch (error) {
    const target = error.sourcePath ?? filename;
    const line = error.sourceLine === undefined ? undefined : error.sourceLine - 1;
    return { files, error: { path: target, line, message: error.message,
      text: parts?.find(part => part.path === target)?.text } };
  }
}
function register(api, context) {
  const collection = api.languages.createDiagnosticCollection('pokemon-story');
  const output = api.window.createOutputChannel('Pokémon Story');
  function validate(document) {
    if (document.languageId !== 'pokemon-story') return;
    const chapter = chapterProblem(document.uri.fsPath, document.getText(), api.workspace.textDocuments);
    if (chapter) {
      for (const file of chapter.files) collection.delete(api.Uri.file(file));
      const error = chapter.error;
      if (!error) return;
      if (error.line === undefined || !error.text) { output.appendLine(error.message); return; }
      const text = error.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')[error.line];
      if (text === undefined) { output.appendLine(error.message); return; }
      const range = new api.Range(error.line, text.search(/\S|$/), error.line, text.length);
      const diagnostic = new api.Diagnostic(range, error.message, api.DiagnosticSeverity.Error);
      diagnostic.source = 'Aurelian League parser';
      collection.set(api.Uri.file(error.path), [diagnostic]); return;
    }
    const metadataPath = document.uri.fsPath?.replace(/\.story$/, '.pokedex.json');
    let metadata;
    try { if (metadataPath && fs.existsSync(metadataPath)) metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')); }
    catch (error) { output.appendLine(String(error)); return; }
    const error = problem(document.getText(), document.lineCount, metadata);
    if (!error) { collection.delete(document.uri); return; }
    if (error.line === undefined) {
      collection.delete(document.uri); output.appendLine(`${document.uri.toString()}: ${error.message}`); return;
    }
    const line = document.lineAt(error.line);
    const range = new api.Range(error.line, line.firstNonWhitespaceCharacterIndex, error.line, line.text.length);
    const diagnostic = new api.Diagnostic(range, error.message, api.DiagnosticSeverity.Error);
    diagnostic.source = 'Aurelian League parser'; collection.set(document.uri, [diagnostic]);
  }
  context.subscriptions.push(collection, output, api.workspace.onDidOpenTextDocument(validate),
    api.workspace.onDidSaveTextDocument(validate), api.workspace.onDidCloseTextDocument(document => collection.delete(document.uri)));
  for (const document of api.workspace.textDocuments) validate(document);
}
module.exports = { problem, chapterProblem, register };
