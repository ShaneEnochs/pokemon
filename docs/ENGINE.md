# The Aurelian League engine

## Current interface

The primary views are **Story | Inventory | Pokédex**, in that order. Inventory
opens directly and shows authored item names and quantities, or an empty message.
Character, Stats, Party, Skills, Journal and People have no visible controls.
Statistics, skills, relationships, journal events, individual Pokémon IDs,
nicknames and the six-member party limit remain supported by the engine and saves.
Switching views preserves choices, text drafts, story state and saved bytes.
Navigation stays sticky; the chapter bar appears beneath it only in Story.

Pokédex discoveries still derive exclusively from committed authored journal
events. Expandable entries can show local artwork. The species-ID map in
`src/pokedex-view.ts` uses Vite-compatible `new URL(..., import.meta.url)` assets;
Chikorita uses `images/152-chikorita.png`. To add another species, add its local
asset and a matching stable species-ID map entry. Missing artwork leaves the
text entry usable; failed image requests remove only the image. Artwork retains
its transparency and aspect ratio. No save schema, identity or revision changes
are needed for these presentation changes. The opening screen is unchanged.


The sole public story is assembled from content/aurelian-league/sources.json, identity aurelian-league,
revision 12. Pokémon-themed private examples exercise historical engine features;
they are not public stories or additional Aurelia lore. See README for the current
workflow and SCRIPTING.md for all syntax.

## Opt-in Pokémon research (engine capability)

The public Chapter 1 records an opening Chikorita encounter with an ordinary
`*journal` effect linked by `discoveryEvents` to authored species metadata.
The Pokédex derives Encountered entries automatically from committed events;
there is no encounter registry or new parser command. Species without metadata
and mere prose mentions produce no entry. Encounter events do not add companions
or show scan cards. Explicit `scanned_...` events remain available for authored
lookups. The optional `dex_installed` gate remains unchanged; Chapter 1 omits it.

## Optional visual passage headings

Each passage still requires a unique authored ID and a nonempty `*title`. An
optional static `*hide_title` immediately after `*title` records
`Passage.hideTitle: true`. In the native reader, the H1 remains focusable and
available to assistive technologies, with the same ID and region association,
but uses the existing `visually-hidden` CSS class. Internal passage titles,
story navigation, author preview, reading context, and save formats are
unchanged. The current public story has only `Chapter 1: A Simple Assignment`.

## Party and save schema

Story.pokemon declares frozen individual ID/species records. GameState.party starts
empty and stores at most six frozen ID/species/optional-nickname records in joining
order. Addition/removal run on the same private entry candidate as other effects.
Duplicate additions and absent removals are no-ops. Rejoining appends. An absent
seventh member, invalid nickname or later unrelated effect failure rejects the
whole entry, including a proposed checkpoint. Nicknames resolve global string
variables once; they never track later variable changes. Conditions reuse the
shared typed AST/evaluator. Party remains hidden in the reader; conditions derive directly from committed state.

The current schema explicitly writes format 4 (plain) or 5 (page/temp context).
Checkpoint-only engine APIs use format 6, retaining checkpoint-entry semantics.
Formats 1–3 are rejected as incompatible. Both current progress and recovery
snapshots require party, including empty party; validators never guess defaults.
Validation rejects unknown IDs/species, duplicates, overflow, malformed nicknames,
extra fields, inherited data and accessors. Continue skips entry effects, while
Try Again replays complete pre-entry state exactly once. The independent key
pokemon:checkpoint:aurelian-league never reads/migrates/deletes old game keys.
The detailed historical API descriptions below use these current boundaries;
any reference to checkpoint-only restoration means the explicit format-6 helper,
not a public-app migration path.


## Validated story data

`parseStory` reads one `.story` authoring format into a complete immutable `Story`
before `new Game` can run. The story contains `initialVariables`, `pokemon`, `skills`, `items`,
`stats`, `startId`, and `passages`. Variable, skill, item, and stat declarations may
be interleaved before all chapters and passages. Each stat references a variable
already declared with `*var`. Primitive variable initial values establish
fixed types. Variable names and stable passage IDs share
`[a-z][a-z0-9_-]*`. IDs are authored, never derived from titles, text, or randomness.
The first passage is the start; all later navigation uses explicit destinations.

A `Passage` contains its ID, static `chapter`, title, optional `checkpoint: true` or `death: true`
designation, ordered literal effects, `paragraphs`, choices,
and optional Continue destination or `textInput` action. A passage has exactly
one concluding category: choices, Continue, text input, death, or terminal. Each paragraph has one uniform record,
in place of the old `Passage.text` string array. `ChoiceCondition` was renamed
`Condition` because both paragraphs and choices use exactly the same data:

```ts
type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

type Condition =
  | { readonly variable: string; readonly operator: '==' | '!='; readonly value: VariableValue }
  | { readonly variable: string; readonly operator: '>' | '>=' | '<' | '<='; readonly value: number }
  | { readonly operator: 'has_skill' | 'lacks_skill'; readonly skillId: string }
  | { readonly operator: 'has_item' | 'lacks_item'; readonly itemId: string }
  | { readonly operator: ComparisonOperator; readonly itemId: string; readonly value: number };

interface NarrativeParagraph {
  readonly text: string;
  readonly condition?: Condition;
}
```

Full interfaces live in `src/types.ts`. Story metadata, paragraph records and
conditions, choices, effects, and their arrays are frozen. There are no callbacks
or executable expressions in story data, parallel text/condition arrays, or
separate content registries.

`TextInputAction` contains only readonly `variable`, `label`, and `destinationId`
strings. The optional `Passage.textInput` record is frozen and JSON-serializable,
with no DOM nodes, callbacks, validators, or executable instructions.

`*chapter Label` is parser metadata. A parser-local label starts as `Prologue`
and is copied into each following passage until another declaration. A chapter
can close a valid previous passage, but cannot bypass missing titles, prose,
choices, or a pending `*show_if`. Every declaration needs a following passage,
and variable/skill/item/stat declarations must come before chapters and the first passage.
Labels are nonempty literal text, not interpolated values; repeated labels are
allowed. There is no mutable runtime `currentChapter`, so navigation order cannot
change a passage's chapter affiliation.

## Shared condition parsing and paragraph boundaries

One `parseCondition` helper validates `variable operator literal`, `has_skill id`,
and `lacks_skill id` for both `[if ...]` choice suffixes and `*show_if ...` narrative
directives. It reuses the
existing identifier/literal rules: strict typed equality/inequality for finite
numbers, booleans and strings, and ordering for numbers only. It rejects unknown
variables, mismatched types, malformed literals, non-finite values, compound
conditions, logical operators, parentheses, and arithmetic expressions. Skill
conditions validate declared skill IDs, with no numeric values or comparisons.
The shared `evaluateCondition` receives committed `GameState` and reads either
its variables, acquired skills, or inventory. Ordinary variable comparisons remain
unchanged, including variable IDs named after condition keywords and optional
whitespace around their operators. Item checks use `has_item id`, `lacks_item id`,
or `item_count id operator quantity`, sharing the existing six comparisons.
Item quantities use nonnegative safe integer decimal literals; absence is zero.
Unknown items and invalid operands are rejected before play.

`*show_if` attaches a condition only to the next narrative paragraph. It must
follow the title and any entry effects at a paragraph boundary. The next physical
source line must be nonblank prose, not another directive. Consecutive prose
lines join with spaces; a blank line flushes the paragraph and clears its
condition. Ordinary following prose is unconditional. Navigation, the next
passage, or EOF also finishes the final paragraph. A new `*show_if` cannot split
an existing paragraph or nest inside another pending condition.

Every passage requires at least one unconditional narrative paragraph. The parser
never manufactures fallback prose. Conditional choice blocks independently require
an unconditional action. All prose/interpolation and destinations are validated,
even when initially hidden or unreachable. Missing/duplicate IDs and titles,
empty paragraphs/choices, misplaced effects/directives, invalid actions, and
unsupported commands are rejected with source lines and passage IDs where
available. Invalid late content cannot partially initialize a game.

## State ownership and deterministic entry

`Game` owns one frozen `GameState` with `passageId`, a frozen `variables` record,
a frozen `journal` array, a frozen `skills` array of acquired IDs, and a frozen
`inventory` record of owned item quantities.
Each frozen `JournalEntry` contains only `id`,
`chapter`, and resolved `text` strings. `Story.initialVariables` is metadata,
never mutable runtime state. Candidates copy the primitive variable record,
journal array, acquired-skill array, and inventory record; existing frozen journal entries can
safely be shared. No deep-cloning framework or separate state manager is needed.
Earlier states and other games cannot change when one game progresses.

Startup and navigation share the existing private `Game.enterPassage` path:

1. Validate an eligible outgoing action against current committed state, or use
   the validated start ID for initial entry.
2. Resolve the destination and copy the complete input state into a candidate
   `next`, with a new variable record, journal array, acquired-skill array, and inventory.
   Initial input uses story variable declarations, empty journal/skills arrays,
   and an empty inventory record;
   ordinary input uses current state.
   For text submission, the accepted text is already in the candidate variables
   before this copy and boundary; no destination effect runs beforehand.
3. **This candidate before effects is the pre-entry checkpoint boundary.**
4. Apply `set`/`add`/`journal`/`grant_skill`/`revoke_skill`/`add_item`/`remove_item` effects once, in source
   order. Assignments preserve types, and every addition must produce a finite
   number. Arithmetic uses normal
   JavaScript floating-point precision. A new journal event resolves its template
   using candidate variables at that exact point, then appends a frozen record
   with the passage's static chapter. There is no expression interpreter.
5. Freeze and return the completed candidate; only a successful return commits
   it. A failure discards all candidate changes, including earlier effects.
   Normal navigation/submission also commits a prepared pre-entry snapshot if the
   destination is marked `*checkpoint`; failures preserve the previous checkpoint.
6. Render the committed state. Reads and rendering never apply effects. A later
   legitimate re-entry is a new entry and applies its effects once again.

Execution never reads DOM state, clocks, randomness, storage, or remote services.
Identical inputs and destinations produce identical results. Failed navigation
or numeric overflow leaves the complete current state unchanged. The browser
keeps the current passage and displays a text error; a failed initial entry
cannot expose a partially started game. Mixed inventory, skill, journal, and variable effects
roll back together, regardless of their order.

## Explicit text submission

`*input_text variable "Label" -> destination_id` is a concluding action after
the passage's title and narrative. The parser reuses the existing identifier and
JSON-string literal rules. It requires a declared string variable, a non-whitespace
label, and an existing destination. Labels are literal, without interpolation;
quoted labels may contain arrows and JSON escapes. Whole-story validation checks
unreachable input passages too. Input cannot coexist with choices/Continue,
repeat within a passage, precede prose, follow another action, or be wrapped by
`*show_if`. No further prose/effects/actions may follow before the next passage
boundary. As with other concluding actions, a top-level chapter can end the
completed passage and assign metadata to subsequent passages.

`Game.submitText(value)` obtains the target variable and destination exclusively
from the current passage. A passage without input rejects submission unchanged.
`navigate()` still accepts only eligible choices or Continue, so it cannot enter
an input passage's destination without a successful submission. Other passages
can independently offer that same destination through their own valid actions.

The pure shared `validateTextInput` accepts only strings. It rejects C0/C1 control
characters and Unicode line/paragraph separators before trimming, so controls
cannot be hidden in outer whitespace. It trims the remaining outer whitespace
and requires 1–80 Unicode code points using string iteration, not UTF-16 length.
Internal spaces, capitalization, punctuation, combining characters, and Unicode
names remain intact. There is no linguistic or expression validation. Input is
plain data: existing single-pass interpolation never interprets inserted text.

Submission creates an independent variable record with that normalized string,
then calls the existing `enterPassage` path with the authored destination. The
complete candidate copies journal, skills, and inventory as usual. Journal text
therefore resolves the accepted value in effect order, and visibility/eligibility
use the resulting committed state. A later authored `*set` may replace it like any
other variable. Entry failure commits neither the input nor any other effect.
Repeated failed attempts do not accumulate changes; the input action remains
available for correction or retry. The same prior state and accepted value produce
the same result. Ordinary later visits apply entry effects once again.

Character creation is story-driven: string/numeric variables hold identity and
attributes, ordinary choices select backgrounds, and normal entry effects assign
variables, skills, inventory, and journal entries. There is no character object,
second variable registry, allocation engine, input history, or instruction stack.

## Binary skills

`Story.skills` is a frozen array of frozen `{ id, name }` definitions, separate
from mutable gameplay data. `*skill id "Name"` uses the existing identifier and
JSON string-literal parsers. Names must be nonempty after trimming; duplicate
names are allowed, duplicate IDs are not. Skill IDs and variable IDs have separate
namespaces. Names are literal text without interpolation. Definitions can only
appear in the initial metadata section, including unused definitions.

`GameState.skills` contains acquired IDs only, as a unique JSON-serializable array
in acquisition order. New games begin empty before initial entry effects.
`*grant_skill id` appends an absent ID; `*revoke_skill id` removes a present ID.
Repeated grants and absent revocations are no-ops. Regranting after removal
appends at the end. Both commands share variable/journal effect placement, run in
source order, and reference declared skills. Unreachable passages and hidden
conditions receive the same validation. There are no conditional effects.

Only the candidate array is changed during entry. Previously committed arrays
are never mutated, and the new array is frozen before exposure. Reads, conditions,
and rendering cannot execute effects. No registry, manager, or mutable eligibility
cache exists. Skills have no numerical values or additional metadata.

## Inventory quantities

`ItemDefinition` contains only `id` and `name`. `Story.items` and its definitions
are frozen static metadata, separate from gameplay state. `*item id "Name"`
uses the existing ID and JSON-string parsers, requires a non-whitespace name,
and rejects duplicate IDs, including unused definitions. Duplicate names are
allowed. Items, skills, and variables have separate namespaces; metadata may
interleave only before all chapters/passages. Names remain literal text.

`Inventory = Readonly<Record<string, number>>` stores only owned quantities in
`GameState.inventory`. New games start empty before initial effects. Values are
positive safe integers; zero properties are deleted. Item IDs begin with letters,
so normal object insertion order matches acquisition order. Updating a quantity
retains its position; removal followed by reacquisition appends at the end.
Every quantity read uses `Object.hasOwn`, preventing inherited properties such
as `constructor` from counting as items. Definitions remain in `Story` and are
never duplicated in state. No Map, Set, manager, or mutable registry is needed.

`*add_item id quantity` and `*remove_item id quantity` share entry-effect placement
and source order. Parsing requires a declared ID and a positive safe integer
written in decimal digits, without signs, leading zeros, decimal points, exponent
notation, variables, or expressions. The same literal parser allows zero for
`item_count` comparisons. `Number.MAX_SAFE_INTEGER` is the inclusive limit.

Each entry candidate spreads the inventory into its own record. Runtime removal
requires sufficient quantity; additions must remain safe integers. Checks occur
after each operation: an invalid intermediate result fails even if a later effect
would repair it. At zero the property is deleted. Only a fully successful entry
freezes and exposes the candidate inventory. Insufficient removal, quantity
overflow, or a variable failure discards all candidate fields, including prior
item changes, skill changes, and journal appends. Repeated failures leave no
hidden state; valid alternatives and successful retries remain possible.

Item conditions use this same committed record after all entry effects. An absent
or inherited-only item counts as zero. Possession means at least one, absence
means zero; numerical comparisons never read the ordinary variable record.
The shared evaluator uses the existing comparison switch. Reads and rendering
never execute item effects or change eligibility.

## Journal recording

The parser reuses its existing string-literal parser and interpolation validation
for `*journal id "Text"`. Event IDs use the passage identifier grammar and must
be unique throughout the entire story, including unreachable passages. Journal
effects have the same title-to-first-prose placement as variable effects; they
cannot be conditional or appear in choices or narrative.

At runtime an event already present by ID is skipped, retaining its original
resolved text and chapter. Ordinary variable effects still run on re-entry.
Different IDs can have the same text. Later variable changes never rewrite
recorded text, and interpolation is single-pass. New games start from an empty
journal before initial passage effects, which may immediately record events.

Journal appends mutate only the candidate array. If an earlier or later effect
fails, none of that entry's variable or journal changes commits. This includes
multiple appends followed by overflow and failed initial entry. Successful retries
record events normally because failed attempts leave no hidden deduplication state.

## Read-only presentation

`StatDisplay` contains only readonly `variable` and `label` strings.
`Story.stats` is a frozen array of frozen displays in author order. `*stat`
reuses the existing identifier and JSON literal rules, requires a previously
declared own variable and non-whitespace string label, and rejects duplicate
variable references and misplaced declarations with source-line context.
Labels remain literal. String, number, and boolean variable behavior is unchanged.
This metadata adds no state fields, effects, conditions, formulas, categories,
or conditional visibility.

`panels.ts` owns the Inventory and Pokédex panels. Both read committed state
when selected. A small helper builds their native buttons, sections and headings;
`reader.ts` retains startup, actions, input, errors, notices and heading focus.
`characterStats(story, state)` remains a pure helper for engine tooling/tests,
but no Stats, Character or Party view is rendered. Inventory is a plain list.
Navigation, submission, Continue Game and recovery select Story.
Toggles never navigate, execute effects, submit drafts, read/write storage, or
change state; focus/error behavior stays in the existing action handlers.

Stat metadata is never persisted. The snapshot schema, save envelope, key, and
`STORY_REVISION = 1` remain unchanged. Adding/removing/reordering/relabeling stat
displays alone is compatible with previous checkpoints. Changes to the underlying
variable declarations/effects still follow the existing revision policy.

`game.passage.paragraphs` and `.choices` retain all authored content in source
order. `game.visibleParagraphs` and `game.availableChoices` return fresh frozen
filtered arrays. Both use the same pure `evaluateCondition` function and current
committed variables, acquired skills, and inventory, after entry effects. They do not cache
visibility, change state, or repeat effects. Re-entry recomputes both views from
its new state.

The renderer consumes these views directly, never evaluates conditions itself,
and creates no elements for hidden paragraphs or choices. Native headings,
paragraphs and buttons retain their semantics and keyboard behavior. All display
content uses `textContent`; heading focus follows navigation.

Stage 8B adds CSS hooks for startup, passage actions, death presentation, and
the two info panels, plus a labeled `role="group"` wrapper for utility buttons.
`style.css` provides a bounded responsive reading column, stacked story actions,
wrapping utility controls, minimum 44px touch targets, visible focus, and consistent
panel/form/error/warning styling. Long content wraps naturally; panels have no
fixed heights or internal scrolling. No animations or scripted scroll behavior
are added, and the viewport remains zoomable.
Stage 10A replaces independent visibility with one active inline view. Text
safety, session semantics, and persistence timing remain unchanged. No state, parser, snapshot, save-envelope, or revision changes occur.

Input passages render one native form inside passage actions, with an associated
label, single-line field initialized from the committed string, and Continue
submit button. Enter submits; the handler prevents page reload and calls only
`Game.submitText`. Browser constraint validation is disabled so the engine owns
validation and error reporting. No native `maxLength` is set because it counts
UTF-16 units rather than Unicode code points. On failure, the same form/value
remains, the field is marked `aria-invalid` and associated with a `role="alert"`
message, and focus returns to it. On success the destination renders and receives
heading focus. Authored labels, narrative, and errors use `textContent`.
Draft text exists only in the field until submission. Rendering or toggling
Inventory or Pokédex never submits it; view changes do not rebuild the input form.

Journal entries and acquired Skills remain in `GameState` for authoring, conditional
narrative, discovery, saves, and recovery. Character, Stats, Party and
the People tab are hidden in the public and author readers. Existing
parsing, validation, event tracking, and tests for their state remain intact.

Inventory is a primary view with its own labeled heading.
`Object.entries(game.state.inventory)` determines insertion order and
quantities; immutable item definitions supply names. Only positive quantities
exist in committed state. List entries use `textContent` for `Name × quantity`;
empty inventory shows “No items in inventory.” Selecting the view reflects changes after
navigation, including deletions. Toggling any section affects presentation only;
there is no UI inventory state or renderer-specific condition logic.

Paragraph records preserve `${name}` placeholders. The pure `interpolate` helper
validates references during parsing and substitutes current post-entry values
when visible paragraphs render. Interpolation is single-pass: inserted strings
are not parsed again, including HTML or `${...}` text. Titles, choice labels, chapter labels, and
variable/condition literals remain literal; journal templates use record-time
interpolation instead. Hidden prose is still validated before
play; a false condition cannot conceal undeclared interpolation references.

`navigate()` enforces the same choice eligibility as the UI. Destinations offered
only by false conditions are rejected without applying destination effects. If
several actions share a destination, one eligible action suffices. Continue is
unconditional. Terminal passages have no actions. There is no implicit traversal,
instruction pointer, call stack, command registry, or nested scripting system.

## In-memory checkpoint capture and restoration

Stage 7A implements exactly one checkpoint owned by `Game`. Its read-only
`checkpoint` getter returns a frozen `GameSnapshot` containing only
`state: GameState`. That state describes the destination **before entry effects**:
passage ID, every primitive variable, the complete ordered journal with original
IDs/chapters/resolved text, acquired skills in acquisition order, and inventory
quantities in record insertion order. Explicit copies freeze all records, arrays,
and journal entries. Snapshots contain no story definitions, derived views, DOM,
form drafts, callbacks, or previous snapshots. There is no history stack.

`*checkpoint` is static `Passage.checkpoint` metadata, not a `PassageEffect`.
The no-argument directive must be the next nonblank directive after `*title`,
before any effects/prose, and may appear only once. All concluding action
categories are permitted. Invalid placement/arguments are line-numbered parsing
errors, including in unreachable passages and conditional/input/choice blocks.

New-game construction prepares an initial snapshot from story defaults and the
start ID, then enters the start passage once. Both state and initial checkpoint
become available only after successful entry. An explicit marker on the start
passage does not add another entry or checkpoint. There is always one checkpoint
after successful initialization, even if the story has no authored markers.

For ordinary navigation and text submission, `transition` prepares a new frozen
pre-entry snapshot only if the destination is marked. It calls the existing
`enterPassage` effect path on an independent candidate, then commits state and
checkpoint together after success. Every legitimate marked re-entry replaces
the snapshot, even if its ID matches the previous one. Ordinary passages, reads,
visibility checks, interpolation, and rendering never capture. Any failure
preserves both previously committed state and checkpoint.

`restoreCheckpoint()` validates/copies the saved pre-entry state and enters its
destination through `enterPassage`. It commits only successful gameplay state
and preserves the checkpoint object itself. It deliberately does not use normal
checkpoint-replacement logic. Repeated restoration produces identical state,
without accumulating effects, journal entries, skills, or inventory. It needs no
outgoing choice from the current passage and performs no reverse operations.

`new Game(story, { checkpoint: data })` accepts unknown snapshot data, validates
it, and enters the saved destination directly. It never initializes the starting
passage first, replays earlier choices, or reconstructs history. Failed validation
or saved entry exposes no partially initialized game. Later mutation of the raw
input data cannot affect the copied/frozen checkpoint or state.

`validateSnapshot` is a schema-specific validator/copier, not a serialization
framework. It requires JSON-shaped plain records (ordinary or null prototype)
and dense native arrays with own enumerable data properties. Accessors, symbols,
hidden/extra fields, inherited data, and exotic containers are rejected without
executing accessor callbacks. The snapshot has exactly `state`, and state has
exactly `passageId`, `variables`, `journal`, `skills`, and `inventory`.

Validation requires an existing non-death passage, exact declared variable names and
matching primitive types, finite numbers, unique declared journal event IDs with
their source passages' chapters and string text, unique declared skill IDs, and
declared inventory IDs with positive safe integer quantities. Own-property checks
handle names such as `constructor`. Recorded journal text is retained as resolved
data, never re-interpolated; ordinary string variables are not revalidated as
player submissions. Invalid data is rejected, never repaired or defaulted.
Validation uses current story definitions without proving historical reachability.
The storage layer separately checks persistent envelope versions before calling it.

Text submission supplies the accepted name before snapshot capture and destination
effects. Restoring that destination preserves the name and does not prompt again;
journal effects execute once in their usual order. Restoring a genuine input
passage instead makes its input action available when rendered. Unsubmitted form
drafts are never gameplay state or checkpoint data.

These engine methods never touch browser storage or DOM. The application renders
an activated restored Game on Continue, just as explicit actions render after
navigation/submission. There is no voluntary Return to Checkpoint control.

## Automatic progress and authored checkpoints (Stage 12A)

Continue Game resumes the most recent successfully saved, committed passage with
its exact post-entry variables, ordered journal, skills, and inventory. It does
not enter the passage again or replay effects. Death passages resume with Try Again;
terminal endings remain endings. Unsubmitted text drafts and selected but
unconfirmed radio choices are not saved.

Authored checkpoints remain independent: each contains the state immediately
before entering the latest `*checkpoint` passage (or the automatic initial
boundary). Try Again re-enters that checkpoint once, discards later changes, and
saves the recovered current state without moving the checkpoint boundary.

Storage is local to this browser and device; it does not synchronize. The public
story uses identity `aurelian-league`, revision 12, and key
`pokemon:checkpoint:aurelian-league`. Private fixture identities are separate.

Format 4 stores one atomic JSON record:

```text
{ formatVersion: 4, storyId, storyRevision, checkpoint: { state }, currentState }
```

`checkpoint.state` is pre-entry; `currentState` is post-entry. Both use the same
strict field/type, passage, journal-event/chapter, skill, and inventory validation;
only committed current state may target death. Format-4/5 recovery targets must be
the start or an authored checkpoint. Validation produces independent frozen data.
The restoration constructor uses `committedState` to restore validated current
state directly, bypassing passage entry. Normal construction and checkpoint
recovery still apply entry effects once.

Checkpoint-only restoration is an explicit format-6 engine API. Public saves
use party-aware format 4/5 and Continue restores committed state without effects.
Unsupported schemas are never rewritten on startup; see the schema contract above.

GameSession saves once after each successful navigation, valid text submission,
and Try Again. New Game must initialize and save successfully before activation;
replacement still requires consent and a fresh save-presence check. Cancel preserves
old progress. `saveProgress` validates and writes the whole record with one `setItem`,
never deleting first. `loadCheckpoint` reads the supported formats; `saveCheckpoint` remains
an explicit checkpoint-only format-6 writer for existing callers and regression fixtures.

Failed gameplay actions do not save. Failed automatic writes retain committed
in-memory gameplay and the prior stored bytes, and warn that recent progress may
be lost. Any later successful committed save clears that warning. Play without
saving never creates or modifies saved records, including on death/retry. Read-only
panels, draft editing, choice selection, rendering, timers, scrolling, unload, and
startup inspection do not save. Browser Back is not gameplay Undo: there is no
history stack, URL state, or Back/Forward gameplay integration.

Local author preview uses the same session with a private memory adapter; Restart
preview clears temporary progress. It never reads or writes public localStorage.

## Static catalog and startup

`src/catalog.ts` is a frozen list of explicit application IDs, titles, descriptions,
Vite `?raw` source, People definitions, and validated StorySaveIdentity records.
Initialization checks distinct catalog/save IDs. Only The Aurelian League
(`aurelian-league`, revision 12) is published. Opening the app parses that entry,
constructs its session and presents startup. It reads only that identity's save;
empty startup never constructs a Game. Continue and confirmed replacement keep
the existing validation and explicit unsaved-play semantics.

Center Visit (`src/example.story`) and Harbor Practice are private Pokémon-themed
regression fixtures. Node and browser regression tests retain their branching,
resource, recovery and discovery coverage. A separate Vite regression build selects
the fixture catalog at compile time into ignored regression-dist; the normal public
build imports neither fixture story nor its metadata. There is no runtime story
switch or test-only route in the app.

`selectStory` keeps the parsed Story, validated People metadata, session, active
Game, and handlers in one closure. There is one renderer. New Game exists only on
startup; reload/reopen returns there. No in-game restart or story switching exists.

For future additions, import a raw source and add an explicit unique catalog/save
identity and People definitions. With multiple entries, the existing inert library
renders selection buttons and pre-game Back to Stories; library rendering itself
never parses stories, initializes games, or accesses saves. No URL routes, hidden
controls, mutable registry, or content service are introduced.

## Death and checkpoint recovery

`*death` is one concluding action after title and narrative, stored only as
immutable `Passage.death?: true`. It has no arguments and cannot coexist with
choices, Continue, input, or authored checkpoint metadata. It must end the passage,
and cannot occur before prose or within conditional prose; a blank line finishes
a conditional paragraph before the action. Whole-story parsing rejects invalid
and unreachable declarations with line/passage context, including an initial
death passage. Every passage still needs unconditional prose.

A death destination follows the same atomic entry path and entry-effect ordering
as every other passage. Its title and visible prose render before a native
Try Again button; no restoration happens on entry or rendering. It has no normal
outgoing action, so existing navigation/input guards remain effective.
Character, Journal, People, and storage warnings remain available. New Game is
confined to startup after reload.

`Game.retryAfterDeath()` verifies the current passage marker, then calls the
existing `restoreCheckpoint()`. No target/snapshot argument, runtime death mode,
history, or recovery registry is added. Restoration validates, prepares, and
commits through the existing path, preserving the checkpoint object. Accepted
names, original journal text/chapters/order, skills/order, inventory/order, and
all variables are restored together. Effects execute once from pre-entry values,
so repeated death/retry cycles give the same resulting state. Failed recovery
leaves death and checkpoint untouched and exposes an error without falling back
to New Game. The browser retains the death passage and Try Again button and focuses
the restored heading only after success.

Checkpoint-only restoration is an explicit format-6 engine API. Public saves
use party-aware format 4/5 and Continue restores committed state without effects.
Unsupported schemas are never rewritten on startup; see the schema contract above.

The example adds only optional watchtower choices/passages; original IDs,
declarations, chapters, effects, and route outcomes stay intact. Revision 1 remains
compatible, so `STORY_REVISION` is deliberately unchanged. Authors choose safe
alternatives; the engine does not prove narrative survivability.

## Authoring preflight

`src/preflight.ts` is separate from browser/runtime orchestration.
`analyzeStory(story, maxRoutes = 2000)` accepts an already parsed immutable Story
and returns a frozen `PreflightReport`. `exploreGameplay` exposes the same bounded
runtime exploration without structural checks. Reports contain diagnostics,
`exploredRoutes` (attempted replay prefixes), `limitReached`, `reentryProbes`,
`successfulReentries`, and `skippedReentries`. Neither function accepts an active Game or uses GameSession,
storage, snapshots for branching, or browser APIs.

Each diagnostic has a stable `code`, `severity` (`error`, `warning`, or
`information`), optional `passageId`, concise `message`, recommended `action`,
and an optional concrete `route`. Route entries have a `passageId` and optional
`input` string: the first creates a fresh Game at start; each later entry calls
`navigate(passageId)`, or `submitText(input)` on the previous passage. The final
entry is the failed attempt. Replay against the same unchanged story to reproduce
the failure. Route arrays/entries and diagnostics are frozen and JSON-serializable.

| Code | Severity | Meaning |
| --- | --- | --- |
| `UNREACHABLE_PASSAGE` | warning | No structural path from start, even with all conditional choices traversable. |
| `REPEATABLE_EFFECT` | warning | A graph-cycle passage has a nonzero numeric add or item add/remove effect; checkpoint metadata is highlighted. |
| `ENTRY_FAILURE` | error | Initial entry or an actually executed eligible transition threw; the runtime message and route are retained. |
| `REPRESENTATIVE_INPUT` | information | Text was submitted as `"Preflight Reader"`; other values remain untested. |
| `REENTRY_TESTED` | information | Aggregated attempted first-return probes and successful return entries; exits may fail separately. |
| `REENTRY_SKIPPED` | information | Eligible returns were omitted by the one-repeat bound or shared route budget. |
| `EXPLORATION_LIMIT` | information | The shared route-prefix budget omitted eligible ordinary, return, or immediate-exit work. |
| `ANALYSIS_SCOPE` | information | The report cannot establish complete story correctness. |

The graph includes choice, Continue, and text-input destinations. Structural
traversals ignore conditions; death and ordinary endings terminate. Iterative
reachability finds unused content and cycle membership by checking whether a
passage is reachable again through its successors. Cycle warnings preserve
authored passage/effect order, include unreachable cycles, and do not imply that
conditions permit the cycle. Journal, set, skill grant/revoke, and zero numeric
adds are not accumulation warnings. This does not prove those effects harmless
in all surrounding gameplay states.

Breadth-first exploration queues complete action prefixes in authored choice
order. Each prefix is replayed from a fresh Game; Game alone filters choices,
validates actions/input, applies effects, and captures private in-memory checkpoints.
No effect arithmetic or condition evaluator is duplicated. Converging paths keep
their distinct histories; only equivalent eligible choices with the same
destination in one state are collapsed. No state is copied into another game via
a fabricated checkpoint. A failed prefix stops there; a death or ordinary ending
is not itself a failure. Recovery is deliberately not followed.

Stage 9D gives queue entries three fixed phases: ordinary, re-entry, and follow-up.
Ordinary prefixes remain simple. An eligible action back to an ID already in the
route queues a re-entry prefix, replayed completely from a fresh Game through the
return. After successful entry, current Game eligibility is read again. Each
eligible exit to an unvisited ID queues one follow-up prefix, which is never
expanded. Exits to previously visited IDs are skipped, preserving the strict
one-repeated-entry bound. Failed returns and death passages have no follow-ups.
This is one fixed search, with no strategy selection or arbitrary recursive loops.

The queue holds at most `maxRoutes` prefixes (a positive safe integer, default
2,000), shared by all three phases. `exploredRoutes` counts every replayed prefix
once, including failures and initial entry. `reentryProbes` counts distinct
first-return prefixes whose return action was attempted; `successfulReentries`
counts successful return entries, regardless of a subsequent exit failure.
Replaying that return as part of a follow-up is included in that follow-up's
prefix execution, not counted as another distinct probe. `skippedReentries`
counts eligible return actions rejected by the one-repeat bound or budget.
Budget omissions set `limitReached`, including omissions of first returns or
follow-ups. Further-return omissions also receive `REENTRY_SKIPPED` even when
the queue budget is not exhausted. Successful/failed return totals use a single
`REENTRY_TESTED` summary, rather than one information diagnostic per cycle.
Failures retain the whole repeated-ID route. Identical route/message failures
are suppressed; different routes to the same failing passage remain useful.

The limit bounds exploration work, not the size of the input file or structural
graph. A drained queue is not evidence about longer loops, continuations beyond
the immediate exit, other input values, restoration, or narrative intentions.
Re-entered checkpoints update normally through Game; a failed entry preserves
its prior state/checkpoint. No checkpoint restore or Try Again is invoked.
Reports append runtime diagnostics in deterministic breadth-first discovery order
after structural warnings. CLI grouping preserves that order within each passage.

`scripts/check-stories.ts` reads the two bundled files by default, or explicit
`.story` paths supplied after `npm run check:stories --`. It parses normally,
prints diagnostics grouped by file/passage plus counts, and exits 1 for parser,
file (`PARSE_ERROR`/`FILE_ERROR`), or reproduced runtime errors. Warnings and
information exit 0. No browser bundle imports the analyzer or CLI. CI runs the
command as well as the existing Node/build/Chromium checks.

The bundled-story review found no confirmed defects or structural warnings:
The Pokémon Center has 14 prefixes, no return candidates, and two information diagnostics.
Harbor Practice has 1,098 prefixes and four information diagnostics. Its four
first-return probes succeed; eight immediate exits are checked. The intentional
queue/offer cycle keeps one original journal event on return. Four further
returns to the already visited offer are skipped by the one-repeat bound.
Both use representative input and report scope, and neither reaches the default
limit. No story defect was found. Existing route/recovery tests remain
necessary; authored sources, identity/revision, and browser gameplay are unchanged.

## Later stages — not implemented

Stage 8A adds read-only selected statistics and limited panel organization.
Stage 8B adds responsive reading styles. Stage 8C adds permanent browser integration
tests. Stage 8D adds the separate Harbor Practice story and API playtests without
engine changes. Its playtest notes document current language/deployment limits;
Stage 9A adds explicit story identity configuration and shared-storage isolation
tests. Stage 9B adds the static two-story browser library with independent startup
and progress. Stage 9C adds separate authoring preflight and concrete-route diagnostics;
Stage 9D extends it with bounded first returns and immediate-exit probes.
Continue Game, confirmed New Game, browser checkpoint storage, and death/Try Again
are implemented. In-story Continue still follows its explicit destination.
Traditional Undo, history stacks, manual
rewind, Return to Checkpoint controls, manual saves, and multiple slots remain
excluded. Static story metadata stays outside snapshots.

## Scope and verification

Implemented: typed variables, literal entry effects, conditional choices,
one-paragraph conditional narrative, chapter metadata, journal recording/viewing,
binary skill definitions/acquisition/revocation/viewing, interpolation, validated text authoring,
item definitions/quantities/conditions and inventory viewing,
one-field player text input and story-driven character creation,
in-memory checkpoint capture/validation/restoration,
versioned localStorage checkpoint persistence, static story library, and per-story startup,
author-controlled death and guarded Try Again recovery,
static stat-display declarations and read-only Character viewing,
explicit navigation, and basic rendering. No dependencies or visual redesign are
needed. Ordinary TypeScript iteration over data is not a story-language loop.

Further character features, arithmetic expressions,
and the later interface/authoring roadmap require future tasks. Randomness,
glossary, shops, skill purchasing, manual saves, save slots, import/export,
procedures, subroutines, loops, and plugin systems remain excluded. System
Awakening is reference only and its engine architecture is not imported.
Skill levels, experience, purchasing, rarity, categories, cooldowns, passive
bonuses, and progression trees are excluded.
Inventory excludes shops, buying/selling systems, equipment, crafting, weight,
capacity, rarity, durability, categories, descriptions, and passive effects.
Numeric input, multiple fields, complex forms, point-buy, portraits, visual
customization, and an editable character sheet are excluded.

`npm test` covers parsing, shared comparisons, paragraph boundaries, visibility
and eligibility after effects/re-entry, interpolation, immutability, exactly-once
execution, navigation, chapter metadata, journal ordering/deduplication,
record-time interpolation, skill metadata/conditions/acquisition order/revocation,
nested immutability, item literal validation, own-property safety, quantity limits,
insertion order, and mixed-effect atomic failure. Text-input coverage includes
parsing/normalization, Unicode limits, submission guards, input rollback,
exactly-once destination entry, and character-background routes.
Checkpoint tests cover pre-entry capture, replacement/re-entry, direct fresh
restoration, complete state/order recovery, untrusted data validation, deep
immutability, and atomic failures.
Persistence tests cover envelopes, version/identity gates, read/write failures,
confirmation/cancellation, atomic New Game replacement, exactly-once loading,
committed progress writes, legacy checkpoint compatibility, Unicode/order retention, and explicit unsaved play.
Death tests cover syntax/metadata, guarded full-state recovery, exactly-once
effects across repeated cycles, failed recovery, accepted names/input checkpoints,
atomic progress replacement, preserved bytes on write failure, newer in-memory checkpoints, and warnings.
Stat tests cover earlier-variable references, labels, order/immutability, primitive
formatting, state updates, read-only inspection, and pre-existing save compatibility.
`npm run build` checks source/tests
with strict TypeScript and builds the app. Browser checks cover hidden content,
rerendering, keyboard navigation, and inert HTML-like interpolation.

`.github/workflows/ci.yml` runs `npm ci`, `npm test`, `npm run build`, and
`npm run test:e2e` on Node.js 22 for PRs to `main` and pushes to `main`, with only
`contents: read`. It installs Playwright Chromium/system dependencies and uploads
failure traces/screenshots and the HTML report. The isolated production browser
suite supplements the unchanged Node tests without app hooks or test-only routes.
See README for local installation and diagnostics. CI does not deploy, publish,
or merge anything.


## Compact reading views and deliberate choices (Stages 10B–10C)

Gameplay starts with three responsive controls: Story, Inventory and Pokédex. The primary grid keeps one row at 320px. Flat tabs have at least 44px targets, approximately 0.9rem labels,
and exactly one active bottom-border indicator. No tab interaction underlines text.
An opaque CSS sticky wrapper holds the tabs and a separate compact chapter bar,
derived from `game.passage.chapter` after each successful action and visible only
in Story. Selecting another view hides the chapter before focus moves. A synchronous
height measurement and ResizeObserver keep scroll spacing equal to the actual header. The passage
heading remains in scrollable content, centered and 10% larger, while prose stays
left-aligned. The centered chapter label has compact padding. CSS scroll spacing
accounts for the sticky header and keeps focus visible.
Branding remains on library/startup screens, which have no chapter bar. One active
content view uses the same centered column at every viewport width. Native
buttons expose aria-pressed; hidden subtrees are removed from keyboard and
assistive navigation. Information headings receive focus on selection; Story
returns focus to the passage heading. This is presentation only, with no new
story directives or persisted state.

The shared reader retains the story DOM while information is shown, so unsubmitted text,
validation errors, and selected choices survive. It refreshes only the selected read-only view through
panels.ts. View selection never runs GameSession actions, rerenders the passage,
or touches storage. Save warnings stay outside the hidden content. New Game is
confined to startup.
Successful navigation/input/retry rebuild the passage and select Story. Checkpoint
and save compatibility remain unchanged. The muted palette uses system fonts;
there are no animations, overlays, sidebars, or separate mobile navigation.

Authored choices are native radio rows within a labeled fieldset, followed by
Continue. Every render starts with no selection and disabled Continue. Selecting a radio
only records a transient choice in that passage's rendering closure and enables
Continue; it never calls Game/GameSession or touches persistence. Native arrow keys
and Space select, Tab reaches Continue, and Enter/Space commits. Continue calls only
`session.navigate(selected.destinationId)`; Game still enforces eligibility and
applies effects. Success rebuilds the passage and drops selection, including
same-ID entries and recovery. Failure retains the DOM, choice, and existing error
behavior. Reload never persists the uncommitted selection. Continue, text-input
submission, Try Again, terminal endings, and New Game keep their distinct behaviors.

`people.ts` validates optional per-story arrays associated through `catalog.ts`.
Private regression definitions live under examples, outside the public bundle.
Each PersonReference has `id`, `name`, `description`, and `discoveryEvents`,
with optional `facts` entries containing `text` and `discoveryEvents`. The short
description must reflect information known when the person first appears; further
facts become visible only after one of their associated events has been recorded.
`validatePeople` checks stable/unique IDs, nonempty text, immutable nested metadata,
and that all person/fact event IDs exist in the selected parsed Story before session
construction. The library remains inert: importing metadata does not parse stories
or read saves. `encounteredPeople` filters names, and `learnedPersonFacts` filters
their personal details, using only the committed journal at render time.
Recovery naturally removes references and facts whose events were rolled back.
Prose alone adds no tracking. Neither People nor its facts are fields in Story,
GameState, snapshots, or save envelopes.

## Local author preview (Stage 11A)

`reader.ts` shares the existing startup, actions, information views, errors, and
focus handling. `main.ts` supplies the public catalog story and localStorage
adapter; development-only `author.ts` supplies a parsed local file and fresh
in-memory storage. The preview index reads structural metadata only and never
navigates Game. File selection alone parses; restart reuses that immutable Story.
The production build has only index.html; Pages checks exclude author.html and
its code. VS Code tasks reuse the bounded CLI. See [AUTHORING.md](AUTHORING.md).

## Advanced authoring (Stage 12C)

See [the complete playable example](../examples/advanced-authoring.story). It is a
local draft/example, not a public catalog entry. Select it at `/author.html` to
exercise pronoun presets, plural agreement, Unicode capitalization, nested guards,
conditional effects, local variables, formatting, pages, and unavailable choices.

- `${name}` is unchanged; `$!{name}` uppercases the first Unicode code point and
  `$!!{name}` uppercases the complete value, without changing the variable. Numbers
  and booleans are converted to their existing string representation first.
- `@{plural_verbs are|is}` selects between two authored strings using a declared
  boolean. Exactly one pipe, a single-line expression, and no nested inline
  expressions are supported. Branch whitespace is literal after the separator;
  normal variable/pronoun substitutions inside the selected branch are supported.
  Missing delimiters and non-boolean selectors are errors. Only the selected
  branch is resolved at runtime; player values are never recursively interpreted.
  Gender is independent; configure `plural_verbs` explicitly for custom pronouns.
- `*comment Author note` requires nonempty note text. It is ignored between
  declarations, narrative lines, and choices, without flushing paragraphs.
- Conditional blocks use spaces and a consistently indented body. Align `*elseif`
  and `*else` with their `*if`; dedent to finish. Nested blocks are supported.
  Operators have precedence: comparisons/presence predicates, then `not`, then
  `and`, then `or`. Parentheses override precedence. Boolean variables can stand
  alone. Comparisons retain strict literal typing; skill and inventory predicates
  use their existing declarations. These conditions also work in `*show_if` and
  flat choice suffixes. Effects still must precede all narrative: putting effects
  in a later branch after narrative is an error, not a reason to reorder them.
  Entry guards select each branch once against the candidate state at that point;
  earlier effects, including temp changes, are visible. Narrative and choice guards
  use committed state. Only individual choice lines can be guarded; action blocks,
  passage headers, declarations, and navigation directives cannot be conditional.
- `[b]bold [i]and italic[/i][/b]` produces semantic strong/emphasis nodes in
  narrative. Tags must balance within each paragraph. Player values use text nodes,
  so hostile-looking input never becomes formatting or HTML. Journal output stays
  plain text (format tags in a journal are literal).
- `*page_break` has no label/arguments. Continue reveals the next visible page;
  final choices/input/Continue/Try Again remain hidden until the final page.
  Empty conditional pages are skipped. Each page advance saves once and focuses
  the passage heading; it never re-enters a passage or captures a checkpoint.
- `[if condition]` hides a choice. `[selectable_if condition]` keeps it visible
  with a disabled native radio control. Disabled choices are rejected by the engine
  and excluded from preflight routes. Every conditional menu needs an unconditional,
  enabled fallback. No nested choice menus are introduced.
- `*temp local_name false` declares a passage-local typed literal after title and
  optional checkpoint, before effects. Temps cannot shadow globals, appear in stats,
  or receive text-input submissions. Existing `*set`/`*add` can change them. They
  work in interpolation, inline booleans, conditions, and journal templates, then
  disappear on leaving. Re-entry and checkpoint recovery initialize them afresh.

Format 5 is used when progress needs page/temp context; it adds validated `context`
with `page` and `temps` alongside the existing currentState and checkpoint. Plain
passages continue writing format 4. Formats 1–3 are incompatible with party state and are rejected. Missing context for a passage
whose declarations changed is incompatible rather than guessed. Page targets must
be authored visible pages and temp fields/types must exactly match declarations.
Both global GameState and pre-entry checkpoints include the frozen party. Authored
story changes still require intentional revision management. Save keys, warnings,
atomic writes, memory-only author preview, and death recovery retain their meaning.

Preflight advances through visible pages without replaying effects, then explores
only enabled routes. Analysis is bounded; it does not prove all loops/resources or
all possible input-dependent grammar. Use local playtests alongside diagnostics.

## Event-derived Pokédex and Inventory

`pokedex.ts` validates copied/frozen per-species metadata (stable ID, display name,
description, discoveryEvents and optional acquisitionEvents) before sessions start.
`discoveredPokemon` derives species in first recorded journal order, status and
chapter, without reading prose, party names or persistence. Every event reference
must exist in the selected story. Acquisition status requires an authored journal
event paired with the party effect, so it survives removal without a second store.

The public catalog loads content/aurelian-league.pokedex.json with Chikorita's
number, Grass type, description and opening encounter event. Author preview uses
the same metadata and accepts optional local .pokedex.json files in memory-only
play. Source assembly preserves narrative, choices and outcomes.

This adds no GameState field, save format or key. Revision 12 intentionally
rejects revision-11 and older progress because Continue must not backfill or
replay the newly added initial event. Checkpoints preserve exactly their
journal-based discovery boundary, matching People semantics.

View selection changes only native pressed buttons and hidden content;
headings receive focus. The reader keeps the story DOM and any drafts,
errors or selections. Primary navigation stays in one row with 44px targets. The
chapter is hidden in information views, and header height updates before focus plus
on later resize/text scaling. No parser or gameplay transition changes are needed.

## Ordered chapter sources and completed Pokédex presentation

The public story is assembled eagerly from the ordered
`content/aurelian-league/sources.json` list: globals and Chapter 1.
One complete source still enters the existing parser and one Game/session;
no dynamic loading or per-chapter state/save exists. The pure story-source helper
normalizes file boundaries and maps parser diagnostics to a filename/local line.
CLI checks of any public member validate all sources; editor diagnostics use
open buffers, and author preview has a public chapter button with memory saves.

The Pokédex respects the optional global dex_installed flag, with legacy fixtures
without it remaining usable. Only authored lookup records unlock public species.
Metadata preserves optional National number, types, category, official summary,
HTTPS source URL and frozen eventId/text observations. Derived entries include
only journal-recorded notes in journal order. Native details/summary controls display species number, name, type, status, and a local thumbnail when available. A single discovered species opens by default, while multiple species start collapsed. The Pokédex shows a derived species count; expanded entries present the description and first encounter chapter, with an optional authored firstEncounterLocation. There is no Field Notes section in the Pokédex panel. Journal observations remain supported in the underlying data and in authored in-story scan cards. The redundant Return to Story button is omitted because the sticky Story tab remains available. No state or storage changes occur when opening views.

In-story cards require a scanned_ effect authored in the current passage and its
committed journal record. They use the shared safe DOM renderer, show only the
current scan's observations, and never execute effects or re-evaluate guards after
entry. No new directive is needed. The restaurant delay/Livia consequences remain
author-controlled and unchanged. See AUTHORING.md for the full contract/examples.

The original physical split preserved the then-current source and gameplay.
The Chapter 1 replacement originally advanced the public story to revision 10.
The subsequent Public Sans/four-tab/field-kit update advanced it to revision 11.
The initial Chikorita encounter then advances it to revision 12.
The story ID, storage key, GameState schema, save formats, and checkpoint semantics
remain unchanged. Existing revision-8 saves are rejected rather than migrated
because their recorded chapter labels are incompatible.
