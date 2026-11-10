import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStory } from '../src/story';
import { validatePokedex, inlineLookups, passageLookups } from '../src/pokedex';
import { Game } from '../src/game';
import { GameSession } from '../src/session';

const entry = {id:'chikorita',name:'Chikorita',description:'Grass friend.',discoveryEvents:['scanned_first']};
const source = `*var show true
*passage start
*title Scan
*journal scanned_first "Scanned Chikorita."
Before.

*page_break
Second page.

*show_if show
*pokedex chikorita

After.
*continue end
*passage end
*title End
Done.
*death`;

test('markers are frozen anchors with ordinary page and condition metadata; rendering is read-only',()=>{
 const story=parseStory(source), entries=validatePokedex(story,[entry]),game=new Game(story);
 const marker=game.passage.pokedexMarkers![0]!;
 assert.equal(marker.beforeParagraph,2); assert.equal(marker.page,1);
 assert.ok(Object.isFrozen(marker)); assert.ok(Object.isFrozen(game.passage.pokedexMarkers));
 const before=game.state;
 assert.deepEqual(inlineLookups(entries,game.state,game.passage,0,game.variables),[]);
 game.advancePage();
 assert.deepEqual(inlineLookups(entries,game.state,game.passage,1,game.variables).map(c=>c.entry.id),['chikorita']);
 assert.equal(game.state,before);
 assert.deepEqual(inlineLookups(entries,game.state,game.passage,1,{show:false}),[]);
 assert.deepEqual(inlineLookups(entries,{...game.state,journal:[]},game.passage,1,game.variables),[]);
 assert.deepEqual(inlineLookups(entries,{...game.state,variables:{dex_installed:false}},game.passage,1,{show:true}),[]);
});
for(const marker of ['*pokedex','*pokedex Bad','*pokedex chikorita extra']) test('rejects invalid marker '+marker,()=>{
 assert.throws(()=>parseStory(source.replace('*pokedex chikorita',marker)),/Pokédex species/);
});
test('rejects misplaced/repeated markers and invalid metadata linkage',()=>{
 assert.throws(()=>parseStory('*pokedex chikorita\n'+source),/boundary/);
 assert.throws(()=>parseStory(source.replace('Before.','Before.\n*pokedex chikorita')),/boundary/);
 assert.throws(()=>parseStory(source.replace('After.','*pokedex chikorita\n\nAfter.')),/Repeated/);
 assert.throws(()=>parseStory(source+'\n*pokedex chikorita'),/boundary/);
 assert.throws(()=>validatePokedex(parseStory(source),[]),/unknown species/);
 const story=parseStory(source.replace('*journal scanned_first "Scanned Chikorita."','*journal encountered_first "Encountered."'));
 assert.throws(()=>validatePokedex(story,[{...entry,discoveryEvents:['encountered_first']}]),/matching scanned_/);
 assert.throws(()=>validatePokedex(parseStory(source),[entry,{...entry,id:'other'}]),/ambiguous/);
});
test('uncommitted guarded scans and branch-hidden cards reveal nothing; legacy eligibility remains',()=>{
 const story=parseStory(source.replace('*journal scanned_first "Scanned Chikorita."','*if show == false\n  *journal scanned_first "Scanned Chikorita."'));
 const entries=validatePokedex(story,[entry]),game=new Game(story);
 assert.deepEqual(inlineLookups(entries,game.state,game.passage,1,game.variables),[]);
 const legacy=parseStory(source.replace('*pokedex chikorita\n','').replace('*show_if show\n',''));
 assert.equal(passageLookups(validatePokedex(legacy,[entry]),new Game(legacy).state,legacy.passages[0]!).length,1);
 const block=parseStory(source.replace('*show_if show\n*pokedex chikorita','*if show == false\n  *pokedex chikorita'));
 assert.deepEqual(inlineLookups(validatePokedex(block,[entry]),new Game(block).state,block.passages[0]!,1,{show:true}),[]);
});
test('page save/resume and checkpoint recovery retain scans without new save fields',()=>{
 const story=parseStory(source),entries=validatePokedex(story,[entry]); let raw:string|null=null;
 const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
 const session=new GameSession(story,storage); session.newGame(()=>true);session.advancePage();
 const saved=raw, resumed=new GameSession(story,storage);resumed.continueGame();
 assert.equal(raw,saved); assert.equal(resumed.game!.resumeContext!.page,1);
 assert.equal(inlineLookups(entries,resumed.game!.state,resumed.game!.passage,1,resumed.game!.variables).length,1);
 resumed.navigate('end');resumed.retryAfterDeath();
 assert.equal(resumed.game!.state.journal.length,1);assert.equal(resumed.game!.resumeContext!.page,0);
});

test('multiple species preserve authored anchors while false branch markers stay hidden',()=>{
 const story=parseStory(`*var show false
*passage start
*title Scan
*journal scanned_first "Chikorita."
*journal scanned_second "Piplup."
Before.

*pokedex chikorita

Between.

*if show
  *pokedex piplup

After.`);
 const entries=validatePokedex(story,[entry,{id:'piplup',name:'Piplup',description:'Water.',discoveryEvents:['scanned_second']}]);
 const game=new Game(story);
 assert.deepEqual(inlineLookups(entries,game.state,game.passage,0,game.variables).map(c=>[c.marker.beforeParagraph,c.entry.id]),[[1,'chikorita']]);
 assert.deepEqual(inlineLookups(entries,game.state,game.passage,0,{show:true}).map(c=>[c.marker.beforeParagraph,c.entry.id]),[[1,'chikorita'],[2,'piplup']]);
});

test('a card-only page participates in page order and resume context',()=>{
 const story=parseStory(`*passage start
*title Scan
*journal scanned_first "Scan."
Prose.

*page_break
*pokedex chikorita`);
 const game=new Game(story),entries=validatePokedex(story,[entry]);
 assert.equal(game.canAdvancePage,true);game.advancePage();
 assert.deepEqual(game.currentParagraphs,[]);
 assert.equal(game.resumeContext!.page,1);
 assert.equal(inlineLookups(entries,game.state,game.passage,1,game.variables).length,1);
 assert.equal(game.canAdvancePage,false);
});
