import { publicStorySource } from './public-story';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePokedex, validatePokedex, discoveredPokemon, pokemonLabel, passageLookups } from '../src/pokedex';
import { parseStory } from '../src/story';
import { Game } from '../src/game';
import { GameSession } from '../src/session';
import { checkpointKey } from '../src/storage';

const publicStory = parseStory(publicStorySource());
const publicDex = validatePokedex(publicStory, JSON.parse(readFileSync('content/aurelian-league.pokedex.json', 'utf8')));
const definition = { id: 'piplup', name: 'Piplup', description: 'A traveling companion.', discoveryEvents: ['seen'], acquisitionEvents: ['acquired'] };
const source = `*pokemon partner "Piplup"
*item token "Token"
*passage start
*title Start
Piplup is mentioned. A Lapras necklace is mentioned too.
*choice
#Meet -> meet
#Fail -> fail
*passage meet
*title Encounter
*journal seen "You encountered Piplup."
The Pokémon is here.
*choice
#Repeat -> meet
#Join -> join
*passage join
*title Partner
*add_pokemon partner
*journal acquired "Piplup joined your party."
Your partner joins.
*continue camp
*passage camp
*title Camp
*checkpoint
You pause together.
*continue leave
*passage leave
*title Apart
*remove_pokemon partner
Your partner is no longer traveling with you.
*continue end
*passage end
*title Recovery
The private recovery example ends here.
*death
*passage fail
*title Failure
*journal failed "An encounter must not commit."
*remove_item token 1
This transition fails.`;
const story = parseStory(source);
const dex = validatePokedex(story, [definition]);
class Memory {
  raw: string | null = null; writes = 0;
  getItem() { return this.raw; }
  setItem(_key: string, value: string) { this.raw = value; this.writes++; }
}

test('metadata is copied, frozen, incremental and uses stable species IDs', () => {
  const raw = [{ ...definition, discoveryEvents: ['seen'] }];
  const parsed = parsePokedex(raw);
  raw[0]!.discoveryEvents.push('later');
  assert.deepEqual(parsed[0]!.discoveryEvents, ['seen']);
  for (const value of [parsed, parsed[0], parsed[0]!.discoveryEvents, parsed[0]!.acquisitionEvents]) assert.ok(Object.isFrozen(value));
  assert.deepEqual(parsePokedex([]), []);
});
for (const raw of [null, {}, [null], [[]], [{ ...definition, id: 'Piplup' }], [definition, definition],
  [{ ...definition, name: '' }], [{ ...definition, description: ' ' }], [{ ...definition, discoveryEvents: ['seen', 'seen'] }],
  [{ ...definition, discoveryEvents: 'seen' }], [{ ...definition, acquisitionEvents: [1] }],
  [{ ...definition, discoveryEvents: [], acquisitionEvents: [] }], [{ ...definition, discoveryEvents: ['invalid id'] }],
]) test('rejects malformed metadata ' + JSON.stringify(raw), () => assert.throws(() => parsePokedex(raw)));
test('all discovery and acquisition event references must exist in the selected story', () => {
  assert.throws(() => validatePokedex(story, [{ ...definition, discoveryEvents: ['unknown'] }]), /unknown journal event/);
  assert.throws(() => validatePokedex(story, [{ ...definition, acquisitionEvents: ['unknown'] }]), /unknown journal event/);
});
test('prose mentions do not discover species; repeated encounters deduplicate and acquisition upgrades the same entry', () => {
  const game = new Game(story);
  assert.deepEqual(discoveredPokemon(dex, game.state), []);
  game.navigate('meet'); game.navigate('meet');
  assert.equal(game.state.journal.length, 1);
  assert.deepEqual(discoveredPokemon(dex, game.state).map(entry => [entry.id, entry.status]), [['piplup', 'Encountered']]);
  game.navigate('join');
  assert.equal(game.state.party.length, 1);
  assert.deepEqual(discoveredPokemon(dex, game.state).map(entry => [entry.id, entry.status]), [['piplup', 'Acquired']]);
});
test('discovery follows first encounter order and reads the recorded chapter without changing state', () => {
  const extra = { id: 'other', name: 'Other Pokémon', description: 'Another authored entry.', discoveryEvents: ['acquired'] };
  const entries = validatePokedex(story, [extra, definition]);
  const game = new Game(story); game.navigate('meet'); game.navigate('join');
  const before = game.state;
  assert.deepEqual(discoveredPokemon(entries, before).map(entry => entry.id), ['piplup', 'other']);
  assert.equal(discoveredPokemon(entries, before)[0]!.chapter, 'Prologue');
  assert.equal(game.state, before);
});
test('acquired discoveries survive removal, saves/reloads, and checkpoints that contain the events', () => {
  const memory = new Memory(); const session = new GameSession(story, memory);
  session.newGame(() => true); session.navigate('meet'); session.navigate('join'); session.navigate('camp');
  session.navigate('leave'); assert.equal(session.game!.state.party.length, 0);
  const expected = discoveredPokemon(dex, session.game!.state), raw = memory.raw, writes = memory.writes;
  const reopened = new GameSession(story, memory); reopened.continueGame();
  assert.deepEqual(discoveredPokemon(dex, reopened.game!.state), expected);
  assert.equal(memory.raw, raw); assert.equal(memory.writes, writes);
  reopened.navigate('end'); reopened.retryAfterDeath();
  assert.equal(reopened.game!.state.party.length, 1);
  assert.deepEqual(discoveredPokemon(dex, reopened.game!.state), expected);
});
test('recovering an earlier checkpoint derives exactly its journal, just like People', () => {
  const game = new Game(story); game.navigate('meet');
  assert.equal(discoveredPokemon(dex, game.state).length, 1);
  game.restoreCheckpoint(); assert.deepEqual(discoveredPokemon(dex, game.state), []);
});
test('a failed entry cannot record a discovery', () => {
  const failedDex = validatePokedex(story, [{ ...definition, discoveryEvents: ['failed'], acquisitionEvents: [] }]);
  const game = new Game(story), before = game.state;
  assert.throws(() => game.navigate('fail'), /insufficient inventory/);
  assert.equal(game.state, before); assert.deepEqual(discoveredPokemon(failedDex, game.state), []);
});
test('the public opening discovers only Chikorita without adopting it or requiring a scan', () => {
  const game = new Game(publicStory);
  assert.deepEqual(publicDex.map(entry => [entry.id, entry.nationalNumber, entry.types]), [['chikorita', 152, ['Grass']]]);
  assert.deepEqual(discoveredPokemon(publicDex, game.state).map(entry => [entry.id, entry.status]), [['chikorita', 'Encountered']]);
  assert.equal(game.state.variables.dex_installed, undefined);
  assert.deepEqual(game.state.party, []);
  assert.deepEqual(game.state.journal.map(event => event.id), ['met_cassius', 'encountered_chikorita_orchard']);
  game.restoreCheckpoint(); // Initial entry is replayed exactly once.
  assert.equal(discoveredPokemon(publicDex, game.state).length, 1);
  assert.equal(game.state.journal.filter(event => event.id === 'encountered_chikorita_orchard').length, 1);
});
test('revision-11 saved progress remains intact but cannot load under revision 12', () => {
  const memory = new Memory();
  const previous = { storyId: 'aurelian-league', storyRevision: 11 };
  const oldSession = new GameSession(publicStory, memory, previous);
  assert.equal(oldSession.newGame(() => true), 'started');
  const save = JSON.parse(memory.raw!);
  save.currentState.journal = save.currentState.journal.filter((event: { id: string }) => event.id !== 'encountered_chikorita_orchard');
  memory.raw = JSON.stringify(save);
  const raw = memory.raw;
  const next = new GameSession(publicStory, memory, { storyId: 'aurelian-league', storyRevision: 12 });
  assert.equal(next.startup.status, 'invalid');
  assert.match(next.startup.status === 'invalid' ? next.startup.message : '', /incompatible story revision/);
  assert.equal(memory.raw, raw);
  assert.equal(checkpointKey(previous), 'pokemon:checkpoint:aurelian-league');
});

test('numbered species metadata is preserved, copied and frozen', () => {
  const types = ['Electric','Flying']; const observations = [{eventId:'seen',text:'First scan.'}];
  const trainerNotes = ['Nests on coastal cliffs.', 'Give the wings space.'];
  const entry = parsePokedex([{...definition,nationalNumber:940,types,category:'Storm Petrel Pokémon',officialSummary:'Coastal bird.',trainerNotes,observations}])[0]!;
  types.push('Other'); trainerNotes.push('Changed'); observations[0]!.text='Changed';
  assert.equal(entry.nationalNumber,940); assert.deepEqual(entry.types,['Electric','Flying']);
  assert.equal(entry.category,'Storm Petrel Pokémon'); assert.equal(entry.officialSummary,'Coastal bird.');
  assert.deepEqual(entry.trainerNotes,['Nests on coastal cliffs.', 'Give the wings space.']);
  assert.deepEqual(entry.observations,[{eventId:'seen',text:'First scan.'}]);
  assert.ok(Object.isFrozen(entry.types)); assert.ok(Object.isFrozen(entry.trainerNotes));
  assert.ok(Object.isFrozen(entry.observations)); assert.ok(Object.isFrozen(entry.observations[0]));
  assert.equal(parsePokedex([{ ...definition, firstEncounterLocation: 'Countryside outside Lezano' }])[0]!.firstEncounterLocation, 'Countryside outside Lezano');
});
for(const fields of [
  {nationalNumber:0},{nationalNumber:-1},{nationalNumber:67.5},{nationalNumber:'0067'},
  {types:[]},{types:['Water','Water']},{types:['Water',4]},{types:'Water'},
  {category:''},{firstEncounterLocation:''},{officialSummary:' '},{trainerNotes:[]},{trainerNotes:['']},
  {trainerNotes:['Repeated','Repeated']},{trainerNotes:[42]},{trainerNotes:'A note'},
  {observations:{}},{observations:[{eventId:'invalid id',text:'Note'}]},
  {observations:[{eventId:'seen',text:''}]},{observations:[{eventId:'seen',text:'One'},{eventId:'seen',text:'Two'}]},
])test('rejects malformed extended metadata '+JSON.stringify(fields),()=>assert.throws(()=>parsePokedex([{...definition,...fields}])));
test('observation event references must exist; unseen notes remain private and recorded order wins',()=>{
  assert.throws(()=>validatePokedex(story,[{...definition,observations:[{eventId:'missing',text:'Unknown'}]}]),/unknown journal event/);
  const entries=validatePokedex(story,[{...definition,observations:[{eventId:'acquired',text:'Second.'},{eventId:'seen',text:'First.'},{eventId:'failed',text:'Hidden.'}]}]);
  const game=new Game(story);game.navigate('meet');
  assert.deepEqual(discoveredPokemon(entries,game.state)[0]!.observations.map(note=>note.text),['First.']);
  game.navigate('join'); assert.deepEqual(discoveredPokemon(entries,game.state)[0]!.observations.map(note=>note.text),['First.','Second.']);
});
test('the installation gate applies only when the story declares dex_installed',()=>{
  const game=new Game(story);game.navigate('meet');
  assert.equal(discoveredPokemon(dex,game.state).length,1);
  assert.deepEqual(discoveredPokemon(dex,{...game.state,variables:{...game.state.variables,dex_installed:false}}),[]);
  assert.equal(discoveredPokemon(dex,{...game.state,variables:{...game.state.variables,dex_installed:true}}).length,1);
});

test('National numbers render with four digits for authored entries', () => {
  const numbered = parsePokedex([{...definition, nationalNumber: 940}])[0]!;
  assert.equal(pokemonLabel(numbered), '#0940 Piplup');
  assert.equal(pokemonLabel(dex[0]!), 'Piplup');
});
test('lookup cards require a committed scan effect in the current passage, including conditional effects',()=>{
  const s=parseStory(`*var scan false
*passage start
*title Start
Choose.
*choice
#Scan -> result [set scan true]
#Help -> result [set scan false]
*passage result
*title Result
*if scan
  *journal scanned_test "Looked up."
  *set scan false
The scan flag has changed after its guarded event.
*continue end
*passage end
*title End
Just mentioning the species does not produce another card.`);
  const entries=validatePokedex(s,[{...definition,discoveryEvents:['scanned_test'],acquisitionEvents:[],observations:[{eventId:'scanned_test',text:'This scan.'}]}]);
  const skipped=new Game(s);skipped.navigateChoice(skipped.visibleChoices[1]!);
  assert.deepEqual(passageLookups(entries,skipped.state,skipped.passage),[]);
  const scanned=new Game(s);scanned.navigateChoice(scanned.visibleChoices[0]!);
  assert.equal(scanned.state.variables.scan,false);
  assert.deepEqual(passageLookups(entries,scanned.state,scanned.passage)[0]!.observations.map(note=>note.text),['This scan.']);
  scanned.navigate('end');assert.deepEqual(passageLookups(entries,scanned.state,scanned.passage),[]);
});

test('reload and checkpoint recovery retain exactly the recorded scan observations',()=>{
  const s=parseStory(`*passage start
*title First Scan
*journal scanned_first "First lookup."
A first observation.
*continue camp
*passage camp
*title Checkpoint
*checkpoint
Pause.
*continue later
*passage later
*title Later Scan
*journal scanned_second "Second lookup."
A later observation.
*death`);
  const entries=validatePokedex(s,[{...definition,discoveryEvents:['scanned_first','scanned_second'],acquisitionEvents:[],observations:[{eventId:'scanned_second',text:'Later.'},{eventId:'scanned_first',text:'First.'}]}]);
  const memory=new Memory(),session=new GameSession(s,memory);
  session.newGame(()=>true);session.navigate('camp');session.navigate('later');
  const reopened=new GameSession(s,memory);reopened.continueGame();
  assert.deepEqual(discoveredPokemon(entries,reopened.game!.state)[0]!.observations.map(note=>note.text),['First.','Later.']);
  assert.deepEqual(passageLookups(entries,reopened.game!.state,reopened.game!.passage)[0]!.observations.map(note=>note.text),['Later.']);
  reopened.retryAfterDeath();
  assert.deepEqual(discoveredPokemon(entries,reopened.game!.state)[0]!.observations.map(note=>note.text),['First.']);
  assert.equal(reopened.game!.state.journal.some(event=>event.id==='scanned_second'),false);
  const again=new GameSession(s,memory);again.continueGame();
  assert.deepEqual(discoveredPokemon(entries,again.game!.state)[0]!.observations.map(note=>note.text),['First.']);
});

test('public encounters do not create in-story scan cards', () => {
  const game = new Game(publicStory);
  assert.deepEqual(passageLookups(publicDex, game.state, game.passage), []);
  assert.ok(publicStory.passages.every(passage => passage.effects.every(effect =>
    effect.kind !== 'journal' || !effect.id.startsWith('scanned_'))));
});

test('encounters register only configured species on the visited branch and recovery removes later discoveries', () => {
  const story = parseStory(`*passage start
*title Crossroads
Choose a route.
*choice
#Meadow -> meadow
#Coast -> coast
*passage meadow
*title Meadow
*journal encountered_chikorita "Met Chikorita."
*journal encountered_unknown "Met a species with no metadata."
Chikorita is here.
*continue again
*passage again
*title Another Encounter
*journal encountered_chikorita_again "Met another Chikorita."
Another Chikorita is here.
*death
*passage coast
*title Coast
*journal encountered_piplup "Met Piplup."
Piplup is here.
*death`);
  const entries = validatePokedex(story, [
    { ...publicDex[0]!, discoveryEvents: ['encountered_chikorita', 'encountered_chikorita_again'] },
    { ...definition, discoveryEvents: ['encountered_piplup'], acquisitionEvents: [] },
  ]);
  const memory = new Memory(), session = new GameSession(story, memory);
  session.newGame(() => true); session.navigate('meadow'); session.navigate('again');
  assert.deepEqual(discoveredPokemon(entries, session.game!.state).map(entry => entry.id), ['chikorita']);
  assert.deepEqual(session.game!.state.party, []);
  const reopened = new GameSession(story, memory); reopened.continueGame();
  assert.deepEqual(discoveredPokemon(entries, reopened.game!.state).map(entry => entry.id), ['chikorita']);
  reopened.retryAfterDeath();
  assert.deepEqual(discoveredPokemon(entries, reopened.game!.state), []);
  reopened.navigate('coast');
  assert.deepEqual(discoveredPokemon(entries, reopened.game!.state).map(entry => entry.id), ['piplup']);
});
