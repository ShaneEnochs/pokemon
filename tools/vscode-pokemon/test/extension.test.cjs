const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { problem, register } = require('../src/diagnostics.cjs');
const valid = '*passage start\n*title Start\nHello.';
test('language, snippets and tasks retain their registration', () => {
  const manifest = require('../package.json');
  assert.deepEqual(manifest.contributes.languages[0].extensions, ['.story']);
  assert.equal(manifest.contributes.languages[0].id, 'pokemon-story');
  const snippets = JSON.parse(fs.readFileSync(path.join(__dirname,'../../../.vscode/pokemon.code-snippets'),'utf8'));
  assert.equal(Object.keys(snippets).length, 40);
  for (const entry of Object.values(snippets)) { assert.equal(entry.scope, 'pokemon-story,plaintext'); assert.ok(entry.prefix.startsWith('pkmn-')); }
  assert.equal(require('../../../.vscode/tasks.json').tasks.length, 3);
});
test('parser errors preserve their message, passage and zero-based source line', () => {
  assert.equal(problem(valid, 3), undefined);
  for (const [source, line] of [
    [valid+'\n*unknown', 3],
    ['*var score 0\n'+valid+'\n*continue missing', 4],
    ['*var score 0\n*passage start\n*title Start\n*set other 1\nHello.',3],
    ['*var score 0\n'+valid+'\n*choice\n#Go -> start [if score && true]\n#Stay -> start',5],
  ]) {
    const result=problem(source, source.split('\n').length);
    assert.equal(result.line,line); assert.match(result.message,/Line \d+, passage "start":/);
  }
  assert.equal(problem('*passage bad',0).line, undefined);
});
test('open/save validation isolates files and correction/close clear diagnostics', () => {
  const values = new Map(), handlers = {};
  const doc = (uri,text) => ({ uri, languageId:'pokemon-story', getText:()=>text, lineCount:text.split('\n').length,
    lineAt:n=>({text:text.split('\n')[n],firstNonWhitespaceCharacterIndex:0}) });
  const a=doc('a',valid+'\n*unknown'), b=doc('b',valid+'\n*unknown');
  const collection={set:(key,value)=>values.set(key,value),delete:key=>values.delete(key),dispose(){}};
  const api={languages:{createDiagnosticCollection:()=>collection},window:{createOutputChannel:()=>({appendLine(){},dispose(){}})},
    Range:class {constructor(...args){this.args=args;}},Diagnostic:class{constructor(range,message,severity){Object.assign(this,{range,message,severity});}},DiagnosticSeverity:{Error:0},
    workspace:{textDocuments:[a,b],...Object.fromEntries(['Open','Save','Close'].map(name=>['onDid'+name+'TextDocument',fn=>{handlers[name]=fn;return{dispose(){}};}]))}};
  register(api,{subscriptions:[]}); assert.equal(values.size,2);
  assert.deepEqual(values.get('a')[0].range.args,[3,0,3,8]);
  handlers.Save(doc('a',valid));assert.equal(values.has('a'),false);assert.equal(values.has('b'),true);
  handlers.Close(b);assert.equal(values.size,0);
  handlers.Open(a);assert.equal(values.size,1);
});
test('real TextMate tokenization covers directives, choices, conditions, strings and interpolation', async () => {
  const { Registry, parseRawGrammar }=require('vscode-textmate');
  const onig=require('vscode-oniguruma');
  const wasm=fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength));
  const grammarSource=fs.readFileSync(path.join(__dirname,'../syntaxes/pokemon.tmLanguage.json'),'utf8');
  const registry=new Registry({onigLib:Promise.resolve({createOnigScanner:p=>new onig.OnigScanner(p),createOnigString:s=>new onig.OnigString(s)}),loadGrammar:async()=>parseRawGrammar(grammarSource,'grammar.json')});
  const grammar=await registry.loadGrammar('source.pokemon-story');
  const tokens=text=>grammar.tokenizeLine(text).tokens;
  for(const directive of 'var stat skill item chapter passage title choice continue input_text checkpoint journal set add pokemon add_pokemon remove_pokemon grant_skill revoke_skill add_item remove_item death show_if'.split(' ')) {
    assert.ok(tokens('*'+directive+' value').some(token=>token.scopes.includes('keyword.control.directive.pokemon')),directive);
  }
  assert.ok(!tokens('*unknown value').some(token=>token.scopes.includes('keyword.control.directive.pokemon')));
  for(const scope of ['string.unquoted.choice.pokemon','entity.name.label.pokemon','keyword.control.condition.pokemon','keyword.operator.comparison.pokemon','constant.numeric.pokemon'])
    assert.ok(tokens('#Go -> destination [if score >= 2]').some(token=>token.scopes.includes(scope)),scope);
  assert.ok(tokens('#Confront -> arrival [set response "confront"]').some(token=>token.scopes.includes('keyword.control.condition.pokemon')));
  for(const scope of ['string.quoted.double.pokemon','variable.other.interpolated.pokemon'])
    assert.ok(tokens('*journal event "Hello ${name}"').some(token=>token.scopes.includes(scope)),scope);
  assert.deepEqual(tokens('Ordinary narrative.')[0].scopes,['source.pokemon-story']);
});
test('public chapter diagnostics assemble globals and the sole Chapter 1 source', () => {
  const { chapterProblem } = require('../src/diagnostics.cjs');
  const { publicStoryFiles } = require('../dist/parser.cjs');
  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(),'pokemon-chapters-'));
  const files = publicStoryFiles.map(file => path.join(root,file));
  assert.equal(files.length,2);
  const sources = [
    '*var name "Ari"',
    '*chapter One\n*passage start\n*title Start\nHello, ${name}.\n*continue end\n*passage end\n*title End\nDone.',
  ];
  try {
    files.forEach((file,index)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,sources[index]);});
    assert.equal(chapterProblem(files[1],sources[1]).error,undefined);
    const invalid='*chapter One\n*passage start\n*title Start\nHello.\n*passage start\n*title Duplicate\nDone.';
    const result=chapterProblem(files[1],invalid).error;
    assert.equal(result.path,files[1]);
    assert.equal(result.line,4);
    assert.match(result.message,/Duplicate passage ID/);
    const unsaved='*chapter One\n*passage start\n*title Start\nHello, ${other}.';
    const savedOther={uri:{fsPath:files[0]},getText:()=>'*var name "Ari"\n*var other "Sam"'};
    assert.equal(chapterProblem(files[1],unsaved,[savedOther]).error,undefined);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('inline marker diagnostics use selected metadata and source lines',()=>{
 const source='*passage start\n*title Scan\n*journal scanned_one "Scan."\nBefore.\n\n*pokedex chikorita\n\nAfter.';
 const metadata=[{id:'chikorita',name:'Chikorita',description:'Grass.',discoveryEvents:['scanned_one']}];
 assert.equal(problem(source,8,metadata),undefined);
 const error=problem(source,8,[]);assert.equal(error.line,5);assert.match(error.message,/unknown species/);
 assert.match(problem(source.replace('*pokedex chikorita','*pokedex'),8,metadata).message,/Pokédex species/);
});
