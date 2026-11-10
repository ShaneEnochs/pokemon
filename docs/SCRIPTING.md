# Story authoring

Write UTF-8 text in a `.story` file, the supported story authoring format.
Use `tools/notepadpp/starter.story` as a new-draft template.
The parser validates a complete story before play. It produces immutable passage
data; it does not execute JavaScript or the reference engine's language.

## Complete example

```text
*var influence 0
*skill diplomacy "Diplomacy"
*item gold_coin "Supply Token"
*var honor 5
*var loyal false
*var character_name "Unknown"
*skill composure "Composure"
*item gate_token "Gate Token"

*chapter Prologue

*passage city_gate
*title The Pokémon Center
*set character_name "Alexander"
*add influence 1
*grant_skill composure
*add_item gold_coin 10
*add_item gate_token 1
*journal arrived "${character_name} reached the city with influence ${influence}."

At dawn, you arrive outside the city walls.

The guards stand beneath the raised portcullis.
A messenger waits beside the entrance.
Your name is ${character_name}. Your influence is ${influence}.

*choice
  #Speak to the messenger -> messenger
  #Enter the city -> center

*passage messenger
*title A Quiet Warning
*add influence 2
*add honor -1
*set loyal true
*grant_skill diplomacy
*add_item gold_coin 2
*journal met_messenger "You spoke to the messenger."

The messenger lowers their voice.

"The center has been waiting for you."
Your loyalty is ${loyal}.

*continue center

*chapter Chapter One

*passage center
*title The Care Center
*add influence -0.5
*revoke_skill composure
*remove_item gold_coin 5
*remove_item gate_token 1
*journal met_center "You entered the center with influence ${influence}."

The center members turn toward you as you enter.

Influence: ${influence}. Honor: ${honor}. Loyal: ${loyal}.

*show_if has_skill diplomacy
Your exchange with the messenger helps you choose your words.

*show_if lacks_skill diplomacy
Without diplomatic training, you face the center unaided.

*show_if has_item gold_coin
Your remaining coins offer a small reassurance.

*show_if item_count gold_coin >= 7
The messenger's extra coins remain after the entry fee.
```

The first passage starts the story. The player can go directly to `center`
(influence `0.5`, honor `5`, loyal `false`) or via `messenger` and Continue
(influence `2.5`, honor `4`, loyal `true`). The center is terminal: there are no
further actions or automatic fall-through. Variables, recorded journal events,
acquired skills, and inventory persist between passages.
Browser startup offers New Game and, when valid saved progress exists, Continue
Game. Continue resumes the last successfully saved committed passage and exact state
without replaying effects. Authored checkpoints remain dedicated to death recovery.
The Journal subsection under Character groups events in first-recorded chapter order; the messenger
route has an extra event. Stored text keeps its original resolved values.
Both routes acquire Composure at the gate and lose it at the center. Only the
messenger route acquires Diplomacy, changing the center's visible prose. The
Skills section in Character lists current acquisitions by display name, in acquisition order.
The shipped `src/example.story` also offers a third gate choice for a preferred
name and carer/researcher background. It keeps the original start ID and both routes
above; see the text-input section below for a complete independent example.
The shipped example also offers an optional watchtower route from the gate and
practice-route selection, ending in death and Try Again without changing either
original route's outcome.
Both routes start with ten coins and a gate token. The messenger grants two more
coins; center entry removes five coins and the token, leaving seven coins on the
messenger route and five on the direct route. Neither route can underflow.

## Supported syntax

| Construct | Rule |
| --- | --- |
| `*var name literal` | Declares one variable and its initial value before all chapters/passages. Names must be unique. |
| `*stat variable "Display Label"` | Selects a previously declared variable for Character. Initial metadata only; nonempty JSON-string label, one display per variable, in authored order. |
| `*skill id "Display Name"` | Defines immutable skill metadata in the same initial section as variables. Skill IDs must be unique; names must be nonempty JSON strings. |
| `*item id "Display Name"` | Defines immutable item metadata interleaved with variables/skills before all chapters/passages. Unique item ID; nonempty JSON-string name. |
| `*pokemon id "Species"` | Declares an individual Pokémon in initial metadata; unique ID, nonempty JSON string species. |
| `*add_pokemon id [nickname_variable]` | Joins a declared individual; optional global string nickname resolved once. Duplicate additions are no-ops; a seventh member rejects entry. |
| `*remove_pokemon id` | Removes a declared individual if present; absent removal is a no-op. |
| `*chapter Label` | Top-level nonempty literal label for subsequent passages; each declaration needs a following passage. Default: `Prologue`. |
| `*passage id` | Begins a passage with a unique stable ID matching `[a-z][a-z0-9_-]*`. The first passage is the start. |
| `*title text` | Exactly one nonempty literal title per passage, before navigation. Place it immediately after the header. |
| `*hide_title` | Optional, no arguments, immediately after `*title`. Hides that passage's large visible heading while retaining its accessible name. The title is still required. |
| `*checkpoint` | No arguments; static passage metadata immediately after the title and before all effects/prose, at most once. Successful entry captures a replacement checkpoint before effects. |
| `*set name literal` | Replaces a declared variable with a literal of the same type. Only after the title and before any narrative. |
| `*add name number` | Adds a numeric literal to a declared numeric variable. Same placement as `*set`. |
| `*journal event_id "Entry text"` | Records an event once by a story-wide unique ID. Interpolation uses candidate variables at that point. Same placement as `*set`. |
| `*grant_skill id` | Acquires a declared skill if absent. Same placement as `*set`. |
| `*revoke_skill id` | Removes a declared skill if present. Same placement as `*set`. |
| `*add_item id quantity` | Adds a positive safe integer literal quantity of a declared item. Same placement as `*set`. |
| `*remove_item id quantity` | Removes that quantity, failing entry if insufficient; zero deletes the property. Same placement as `*set`. |
| `*comment text` | Author-only note, ignored without interrupting surrounding content. |
| `*temp name literal` | Passage-local declaration after title/checkpoint, before effects. |
| `*if condition` | Indented conditional narrative/effects or individual choices. |
| `*elseif condition` | Alternate branch aligned with its if. |
| `*else` | Final alternate branch; no arguments. |
| `*pokedex species_id` | Display a passage-local committed scan card at this narrative boundary; see Inline Pokédex presentation directive. |
| `*page_break` | Split narrative into resumable pages; no arguments. |
| Narrative text | At least one unconditional paragraph per passage. Nonblank consecutive lines join with spaces; blank lines separate paragraphs. |
| `*show_if name operator literal` | At a paragraph boundary after the title/effects, conditions only the paragraph starting on the immediately following source line. |
| `*show_if has_skill id` / `*show_if lacks_skill id` | Conditions the next paragraph on possession/absence of a declared skill, with the same paragraph boundaries. |
| `*show_if has_item id` / `*show_if lacks_item id` | Conditions the next paragraph on possession/absence of a declared item. |
| `*show_if item_count id operator quantity` | Compares the owned quantity with a nonnegative safe integer literal; absent items count as zero. |
| `${name}` | In narrative only, displays the variable's post-entry value as text. |
| `*choice` | Takes no arguments; starts one or more flat choice lines. Must conclude the passage. |
| `#Label -> destination_id` | Inside a choice block, a nonempty literal label and explicit existing destination. Exactly one `->` separator. |
| `#Label -> destination_id [set name literal]` | Optional assignment to an existing global variable before the destination's entry effects, using the same primitive types and validation as `*set`. One assignment per choice. |
| `#Label -> destination_id [if name operator literal]` | Optional single typed condition, evaluated against the committed post-entry state. The block must include an unconditional choice. |
| `#Label -> destination_id [if has_skill id]` / `[if lacks_skill id]` | Optional skill condition, using the same evaluator and requiring an unconditional fallback. |
| `#Label -> destination_id [if has_item id]` / `[if lacks_item id]` / `[if item_count id >= 1]` | Optional item condition with the same evaluator/fallback rules; all six comparison operators work for counts. |
| `*continue destination_id` | One explicit Continue destination, mutually exclusive with choices. Must conclude the passage. |
| `*input_text variable "Label" -> destination_id` | One concluding text-input action after narrative, targeting a declared string variable and existing passage. Mutually exclusive with choices/Continue. |
| `*death` | No arguments; concludes a non-start, non-checkpoint passage after prose. Mutually exclusive with choices, Continue, and input. |

A passage ends at the next `*passage`, a `*chapter` after a valid passage, or EOF. Terminal passages have no
choices, Continue, input, or death action. After a concluding action, only blank lines, choices inside the
current `*choice` block, or a new chapter/passage are allowed. Additional prose, titles,
effects, duplicate action blocks, or nested choices are errors.

## Pokémon party

Use stable individual IDs, not species IDs. Two definitions may have the same species:

```text
*var starter_nickname ""
*pokemon starter_piplup "Piplup"
*pokemon another_piplup "Piplup"

*passage join
*title A New Partner
*add_pokemon starter_piplup starter_nickname
Piplup joins your party.

*if has_pokemon starter_piplup
  Your new partner is here.

*choice
#Travel together -> next [if has_pokemon starter_piplup]
#Wait -> join

*passage next
*title Onward
*remove_pokemon starter_piplup
Your partner stays behind for this example.
```

Definitions precede all chapters/passages, can interleave with other metadata, and
are frozen `{id,species}` records in `Story.pokemon`. IDs use the standard identifier
grammar; species are nonempty literal JSON strings. Party definitions contain no species database or evolution data. Separate
Pokédex presentation metadata maps explicit journal events to species; see AUTHORING.md.

Addition/removal share other entry effects' placement, source order and atomicity.
The party starts empty, holds at most six unique individuals, and preserves joining
order. Repeated additions and absent removals do nothing. Removing then rejoining
appends at the end. Adding an absent seventh member fails the whole transition;
earlier candidate effects and a proposed checkpoint are discarded.

The optional nickname operand names an already declared **global string variable**,
never a temp, literal, or expression. Empty string stores no nickname. Other values
pass the existing text-input rules (trimmed 1–80 Unicode code points, no controls or
line breaks). The value is copied on joining; changing the variable or adding a
present ID again cannot rename a member. Use `*input_text` for a player nickname.

`has_pokemon id` / `lacks_pokemon id` work in block guards, paragraph guards, and choice
conditions with the shared evaluator. Unknown IDs fail parsing even in hidden paths.
Preflight replays actual Game transitions, including capacity failures.

`GameState.party` is a frozen array of frozen `{id,species,nickname?}` records. It is
included in current saves and pre-entry checkpoints, restored by Continue without
entry and by Try Again with exactly one entry. Validation rejects unknown/mismatched
species, duplicate IDs, extra/missing fields, inherited/accessor entries, malformed
nicknames and parties over six. Party is a read-only view separate from Inventory.
All five views preserve drafts and never execute effects or save on inspection.

## Character statistics

`*stat influence "Influence"` selects an existing variable for the read-only
Character panel. It must follow that variable's `*var` declaration and precede
every chapter/passage. You may interleave stats with variable, skill, and item
definitions, but forward variable references are rejected.

```text
*var influence 0
*stat influence "Influence"
*var character_name "Unknown"
*var loyal false
*stat character_name "Name"
*stat loyal "Loyal"

*passage arrival
*title Arrival
*add influence 2

Your journey begins.
```

Character shows Influence: 2, Name: Unknown, Loyal: No, in that authored order.
Only explicitly selected variables appear. Each variable can be selected once,
even if the labels differ. Different variables may share a label.
References use the existing identifier grammar and must name declared variables,
not skill/item definitions or expressions. Labels must be nonempty after trimming,
use the existing double-quoted JSON literal/escape rules, and remain literal
without interpolation. Malformed labels, unknown/duplicate references, and
declarations in passages or after chapters are source-line errors.

Strings and numbers display as text; booleans display Yes or No. The native
Character button selects a labeled inline view with keyboard access,
`aria-controls`, and `aria-pressed`. Labels and values are inert `textContent`,
even when they contain HTML-like text. No stats shows
“No character statistics configured.”
Views read the current state when presented after navigation, input, Continue Game,
or Try Again. Opening or closing a panel never changes gameplay, repeats effects,
submits draft input, or writes storage.

Frozen `Story.stats` stores presentation references/labels only. Current values
remain in `GameState.variables`. Stat metadata is not part of snapshots or the
browser save envelope. Adding, removing, reordering, or relabeling displays alone
needs no story revision change; incompatible variable changes still do.
No derived stats, formulas, categories, progress bars, point allocation,
or conditional stat visibility are supported.

The responsive interface separates story actions from utility buttons. Panels
remain single active inline; long labels and entries wrap without truncation.
Responsive styling adds no authoring directives and changes no story routes,
effects, saved data, checkpoint timing, or recovery behavior.

## Visible and hidden passage headings

Keep `*title` on every passage as a stable internal and accessible label. Use
`*hide_title` immediately after the title to suppress its large visual heading.
The reader retains a focusable, visually hidden H1 for screen readers and its
story region label. The chapter ribbon remains visible whenever the Story tab is
active, regardless of `*hide_title`. For example:

```text
*chapter Chapter 1: The Crossing
*passage ferry
*title Approaching Lezano Aboard the Portia

The ferry approaches the harbor.
*continue windows

*passage windows
*title A Better View
*hide_title

You move closer to the glass.
```

`*hide_title` cannot be repeated, given arguments, placed inside a conditional,
or used after a checkpoint, entry effect, paragraph, temporary declaration, or
navigation. It never alters saves, state, passage identity, or passage `title`.

## Chapters and journal events

`*chapter Label` is a top-level authoring declaration. Its literal label applies
to the next passage and all subsequent passages until another declaration.
Before any declaration, passages belong to `Prologue`. Labels are nonempty text
with outer whitespace trimmed; quotes and `${...}` remain literal, without
string decoding or interpolation. Reusing a label later is permitted.

A chapter declaration can finish a valid preceding passage, including one with
choices or Continue. It cannot rescue missing titles/prose, empty choices, or
pending conditional prose. Every declaration must have at least one passage
before another chapter or EOF. Variables, skills, items, and stats must precede chapters, and prose/effects
cannot appear between a declaration and its next passage header. Chapters belong
to immutable passage definitions, not a mutable global current chapter; player
navigation order never changes them.

`*journal event_id "Entry text"` is an entry effect after the title and before
all prose. Event IDs match `[a-z][a-z0-9_-]*` and must be unique throughout the
story, including unreachable or mutually exclusive passages. They may match
passage/variable names because those are separate namespaces. Different IDs may
have identical text. Keep event IDs stable when editing text.

Entry text uses the existing double-quoted string rules, including escapes and
empty strings. Interpolation references must be declared and well formed. Text
resolves once, from candidate variables at that exact effect position. Later
`*set`/`*add` effects cannot rewrite it. Inserted strings are never interpreted as
HTML, code, or another template. Journal commands cannot be conditional or appear
inside prose, choices, or after Continue.

Each first recording appends `{ id, chapter, text }` to `GameState.journal` in
effect order. Re-entry runs ordinary variable effects but skips recorded event
IDs, retaining their original chapter and text. New games start with an empty
journal before initial effects, which may immediately record entries. All effects
are atomic: failure rolls back every candidate append, variable change, and skill change. Failed
attempts leave no hidden deduplication history.

The Journal subsection under Character selects a read-only view without navigation or effects.
Chapter groups appear in first-recorded order; entries within a group retain
recording order. Later events in an earlier chapter join its existing group.
An open journal updates after successful navigation. Empty journals display
“No journal entries yet.” Arrays and entries are frozen, and chapter headings
and recorded text use `textContent`.

## Checkpoints

`*checkpoint` marks a passage as an automatic checkpoint. Put it immediately
after `*title` as the next nonblank directive, before every entry effect and all
prose. It has no arguments and may appear only once per passage. It is immutable
passage metadata, not an effect or a conditional command. It cannot appear in
choices, conditional prose, input actions, or after another effect. A marked
passage may otherwise have choices, Continue, text input, or no concluding action,
but cannot be a death passage.
Whole-story parsing rejects invalid usage with source-line/passage context.

```text
*var influence 0
*item gold_coin "Supply Token"

*passage camp
*title The Camp
*checkpoint
*add influence 2
*add_item gold_coin 10
*journal rested "You rested at camp."

You arrive at a safe place to rest.

*continue next_day

*passage next_day
*title The Next Day
*add influence 1
*remove_item gold_coin 1

You set out again.
```

Every new game automatically establishes one checkpoint at the starting passage,
before its entry effects, even without a marker. Starting effects then run once;
an explicit start marker does not run them again. Failed startup exposes no game
or checkpoint. Successful entry to a marked passage replaces the checkpoint with
its complete **pre-entry** state. Re-entry captures a fresh snapshot even when
the passage ID is unchanged. Unmarked passages and state inspection do not replace it.

The snapshot contains all variables (including names), journal entries with their
original chapters/text/order, acquired skills in order, inventory quantities and
insertion order, and the destination ID. It excludes story definitions, visible
paragraphs/choices, form drafts, callbacks, and history. All nested data is copied
and frozen. Failed entry commits neither candidate state nor a new checkpoint.

The engine-only `game.checkpoint` getter exposes `{ state: GameState }`.
`game.restoreCheckpoint()` validates and re-enters that saved passage, executing
effects once and preserving the checkpoint itself. Repeating restoration does
not accumulate effects. In the example, restoring camp always yields influence
2, ten coins, and one journal event, even after visiting `next_day`.
`new Game(story, { checkpoint: data })` validates snapshot data and enters its
destination directly, without first executing the starting passage.

Validation rejects malformed structure, missing/extra fields, wrong variable
names/types or non-finite numbers, unknown/duplicate journal or skill IDs, wrong
journal origin chapters, unknown items, invalid quantities, and inherited or
accessor data. It does not invent defaults or repair quantities. It checks against
current story definitions; the browser save envelope adds an explicit revision gate.

The engine remains in memory and has no restore command in the story language or
voluntary player checkpoint-return control. Stage 7B persists its checkpoint and
provides startup Continue Game; guarded Try Again uses the same restoration.

## Death and recovery

`*death` ends a death passage after its title and narrative. It has no arguments,
can occur only once, and cannot coexist with choices, Continue, or text input.
No further prose or commands are allowed before the next passage/chapter or EOF.
It cannot precede the title or prose or be placed within conditional narrative.
Finish a conditional paragraph with a blank line before the death action.
At least one unconditional paragraph remains mandatory.

A death passage cannot also have `*checkpoint`, and the first passage cannot
be death because it automatically establishes the initial checkpoint. The parser
validates these rules even in unreachable passages. Death is immutable passage
metadata; it adds no variable or separate character/death state.

This complete short route shows recovery from a marked camp:

```text
*var influence 0
*item gold_coin "Supply Token"

*passage camp
*title The Camp
*checkpoint
*add influence 2
*add_item gold_coin 10

You prepare for the journey.

*choice
  #Enter the ruins -> ruins
  #Remain safe -> rest

*passage ruins
*title The Ruins
*add influence 5

You descend into the ruins.

*continue fatal_trap

*passage fatal_trap
*title A Fatal Trap

The floor gives way beneath your feet.

*death

*passage rest
*title Rest

You remain safely at camp.
```

The player sees the fatal narrative and a native Try Again button. The game
waits for that action; it does not recover automatically or ask for confirmation.
Character, Journal, People, New Game, and save warnings remain usable.
Ordinary entry effects are allowed before death prose and execute atomically.
Try Again discards all changes after the checkpoint, including death effects,
and restores variables, journal text/chapters/order, acquired skills/order, and
inventory/order together. Camp again yields influence 2 and ten coins, even
after repeated death/retry cycles. The player can then choose the safe route.
Authors must provide appropriate alternatives; narrative loops are not analyzed.

Recovery uses the current in-memory pre-entry checkpoint, applies its effects
once, and preserves the checkpoint itself. The session saves recovered current
progress once. Death may be saved as current progress, never as a checkpoint.
If the latest automatic save failed, Try Again still uses the newer checkpoint; reopening
instead resumes the last successfully saved progress. Play without saving supports the
same recovery in memory. Failed recovery keeps the death passage and checkpoint
unchanged and shows an accessible error so the player can retry.

A name submitted before the checkpoint destination survives, including journal
interpolation, without prompting again. If the checkpoint genuinely belongs to
an input passage, its form reappears and permits a fresh submission. Drafts and
input histories are never restored. There is no voluntary checkpoint-return
command outside death.

The optional watchtower additions in `src/example.story` preserve existing IDs,
effects, chapters, declarations, and route outcomes. `STORY_REVISION` remains 1
because existing gate/background snapshots remain compatible.

## Browser saving and startup

The application stores one atomic record at `pokemon:checkpoint:aurelian-league`
for the sole public story (`aurelian-league`, revision 9). Other authored applications
must configure distinct explicit identities. Previous-game keys are never read,
migrated, or deleted. Unsupported saves stay untouched until confirmed replacement.

Format 4 contains `formatVersion`, `storyId`, `storyRevision`, `checkpoint`, and
`currentState`. Format 5 adds `context` for reading pages and passage-local temps.
Both states include the complete party. Formats 1–3 lack the new party contract
and are rejected rather than guessed. The engine's explicit checkpoint-only helper
uses format 6 and re-enters the checkpoint; the public application always writes
committed progress (4/5). New Game saves initialized progress before activation.
Navigation, text submission, page advance and Try Again each save once. Reads,
Continue, rejected actions, input drafts, and unconfirmed choices never write.

Continue restores the last committed passage/state/context without replaying entry
effects. Death remains recoverable and terminal endings remain terminal. The separate
checkpoint stores complete pre-entry state for Try Again. All variables, acquired
skills, inventory, journal and party are validated, copied and frozen at both
boundaries. There is no partial recovery or automatic old-schema migration.

Keep authored IDs stable and bump story revision intentionally for incompatible
state declarations, effects, or journal chapter changes. Display-only stat/title
changes do not alter save identity. Envelope/schema changes need an explicit format
version decision; matching versions never bypass full validation.

Startup with unusable saved data explains the problem and offers New Game without
a working Continue option. New Game asks before replacing any existing record,
including unusable saves. Cancel leaves it untouched. Construction must succeed
before one replacement write; if construction or writing fails, old progress and
the previous active game remain. The record is never removed first.

If an automatic progress write fails after entry, committed gameplay and its
in-memory checkpoint remain. A warning explains that closing the page may lose
progress since the last successful save, whose bytes remain intact. A later
successful committed save clears that warning; no timer/unload retries occur.
When storage is inaccessible or a new game cannot be saved, Play without saving
requires explicit consent and leaves old saved progress untouched. That mode
clearly states that progress will be lost on closing. Technical diagnostics are
logged in the browser console. Storage is scoped to the browser profile/origin,
with no cloud synchronization, import/export, or migration tools.

## Skills

Define skills before the first chapter or passage using `*skill id "Display Name"`.
Definitions may interleave with `*var` and `*item` declarations. IDs match
`[a-z][a-z0-9_-]*`, are case-sensitive, and must be unique even if never used.
Skill IDs occupy a separate namespace from variables, passages, and journal
events: `*var diplomacy 0` and `*skill diplomacy "Diplomacy"` may coexist.
Explicit skill commands/conditions distinguish them.

Names use the same double-quoted JSON string literals as variables, including
`\"`, `\`, `\n`, and `\u2665` escapes. They must contain non-whitespace text after
decoding; single quotes, unquoted names, trailing content, and malformed escapes
are invalid. Duplicate display names are allowed because IDs establish identity.
Names remain literal, without `${...}` interpolation, and are rendered as text.
Definitions contain only ID and name and belong to immutable `Story.skills`.
Definitions inside passages or between chapters are errors.

Acquire and remove skills with `*grant_skill id` and `*revoke_skill id`. Both
require declared IDs and appear after the title, before the first narrative
paragraph. They may interleave with `*set`, `*add`, and `*journal`. They cannot
appear inside prose, conditional paragraphs, choice blocks, or after navigation,
and may be guarded by an indented *if block. Effects execute in source order on each legitimate
entry, including initial entry and later returns.

New games start with no acquired skills before initial effects. A grant appends
an absent ID; a repeated grant does nothing. Revocation removes a present ID;
revoking an absent skill does nothing. Revoking and regranting puts the ID at the
end of acquisition order, including within the same passage. Acquired IDs live
only in the unique, frozen, JSON-serializable `GameState.skills` array. No levels,
experience, purchasing, rarity, categories, cooldowns, bonuses, or trees exist.

Use `has_skill id` or `lacks_skill id` wherever a condition is supported:

```text
*skill first_aid "First Aid"

*passage training
*title Training
*grant_skill first_aid

Your training is complete.

*show_if has_skill first_aid
You recognize the instructor's fighting stance.

*choice
  #Demonstrate your first_aid -> rest [if has_skill first_aid]
  #Leave -> rest

*passage rest
*title Rest
*revoke_skill first_aid

This short exercise ends your temporary training.

*show_if lacks_skill first_aid
You can return to acquire the skill again.

*continue training
```

The shared condition parser/evaluator checks committed skills **after all entry
effects**. A grant or revocation immediately changes visible paragraphs and
available choices. Presence checks have no comparison value or level. Compound conditions and
indented guards are documented in Advanced authoring below. Unknown skills are errors
even in unreachable passages or hidden conditions. Conditional choices still
need an unconditional fallback; navigation enforces the same eligibility, and
any eligible choice permits its shared destination. Continue remains ordinary
unconditional navigation.

Skills participate in atomic entry with variables and journal events. An overflow
anywhere in the effects rejects the entire candidate: no skill acquisition,
revocation, journal append, variable change, or new passage ID commits. Earlier
states and other games stay unchanged. Initial entry follows the same rule.
Reads, condition checks, and rendering never execute skill effects.

The Skills section is read-only within Character, below Character Statistics.
The Character tab exposes `aria-pressed`. Skill names come from static
definitions and IDs from current state, in acquisition order; no UI copy of
acquired skills exists. Empty lists show “No skills acquired yet.” Selected views
reflect navigation changes, including removal. Toggling either control changes no
gameplay state. Skill names use `textContent`, so HTML-like names remain inert.

## Items and inventory

Declare each item with `*item id "Display Name"` in the initial metadata section,
interleaved with variables and skills before every chapter/passage. Item IDs use
`[a-z][a-z0-9_-]*`, stay stable when names change, and must be unique, even if
unused. Item, variable, skill, passage, and journal IDs have separate namespaces.
Duplicate display names are allowed. Names use the existing double-quoted JSON
string rules and escapes, must be nonempty after trimming, and stay literal
without interpolation. Immutable `Story.items` stores only `{ id, name }`.
Definitions inside passages or between chapters are invalid.

`*add_item id quantity` adds to the current owned quantity; `*remove_item id quantity`
subtracts it. Both operands are required. Quantities use decimal integer digits
without signs or leading zeros, from `1` through `9007199254740991` inclusive.
Reject zero, negatives, fractions, decimal points, exponent notation, hexadecimal,
`NaN`, `Infinity`, unsafe integers, quoted numbers, variables, or expressions.
For example, `*add_item gold_coin 10` works; `*add_item gold_coin influence`,
`*add_item gold_coin 1e3`, and `*remove_item gold_coin 0` do not.

Item effects must be after the title and before the first narrative line, just
like other entry effects. They may interleave with variables, skills, and journal
commands. They cannot appear in prose, conditional paragraphs, choices, or after
navigation, and may be guarded by an indented *if block. They run once on initial entry and each
legitimate return; reads, rendering, and inventory inspection never rerun them.

New games begin with empty inventory before initial effects. Only owned item IDs
and positive safe integer quantities live in the frozen `GameState.inventory`
record; names stay in story metadata. Adding an owned item increases its existing
quantity. Removing the final quantity deletes its property. Quantity updates retain
display order; removal followed by reacquisition puts the item at the end.
Inherited object properties never count as items, including `constructor`.

Insufficient removal and addition beyond `Number.MAX_SAFE_INTEGER` fail entry with
a passage/item error; quantities are never clamped. Every intermediate operation
must be valid even if a later effect would repair it. The private candidate has
its own inventory record: failure discards all inventory, variable, journal, skill,
and passage-ID changes, including on initial entry or repeated attempts. Earlier
states and other games remain unchanged. Inventory is JSON-serializable and will
be preserved by the single checkpoint without a separate recovery system.

All existing condition locations support `has_item id`, `lacks_item id`, and
`item_count id operator quantity`. Counts use the same six operators as variables:
`==`, `!=`, `>`, `>=`, `<`, and `<=`. Operands are **nonnegative** safe integer
decimal literals, so zero is valid here. Absent items count as zero. Possession
means at least one; absence means zero. Item counts never read ordinary variables.
Unknown items are errors, including in hidden or unreachable content.

```text
*item gold_coin "Supply Token"
*item gate_token "Gate Token"

*passage gate
*title The Gate
*add_item gold_coin 10
*add_item gate_token 1

The guard gives you a token.

*show_if has_item gate_token
The token identifies you as a visitor.

*choice
  #Enter the center -> center [if item_count gold_coin >= 5]
  #Wait outside -> gate

*passage center
*title The Center
*remove_item gold_coin 5
*remove_item gate_token 1

The clerk collects your token and five coins.

*show_if lacks_item gate_token
Your token has been handed in.
```

The shared evaluator reads committed state after all entry effects. Acquiring or
removing items immediately changes available choices and visible paragraphs.
Conditional choices still require an unconditional fallback, and navigation uses
the same eligibility rules, including shared destinations. Compound boolean conditions and conditional entry effects are supported;
variable-to-variable comparisons and arithmetic expressions remain unsupported. Existing variable/skill conditions and Continue remain unchanged.

The Inventory section is read-only within Character, below Skills. It derives names from
`Story.items` and quantities/order from `GameState.inventory`, listing only owned
items as `Name × quantity`. Empty inventory shows “No items in inventory.” Open
sections update after navigation, including items removed at zero. Toggling any
control never changes gameplay state or navigates; item names use `textContent`,
so HTML-like strings remain inert. There is no UI inventory copy or sorting layer.

Only names and quantities exist: no descriptions, custom properties, shops,
buying/selling systems, equipment, crafting, rarity, durability, weight, capacity,
categories, or passive effects.

## Variables and literal values

Declare every variable before all chapters and passages; declarations cannot appear
inside passages. Names are case-sensitive and follow the same lowercase ASCII
identifier grammar as passage IDs. `influence`, `chapter_1`, and `honor-total` are
valid; `Influence`, `1honor`, and names containing spaces are not. A variable name
and a passage ID may be identical: they are separate kinds of identifier.

Supported literals:

- **Numbers:** finite JSON-style numbers, including `0`, `-1`, `0.25`, `-0.5`,
  and `1e3`. Use a leading digit for decimals. No leading `+`, leading zeroes
  such as `01`, hexadecimal, `NaN`, or infinities. Arithmetic uses normal
  JavaScript floating-point precision; numeric overflow fails passage entry.
- **Booleans:** exactly `true` or `false`.
- **Strings:** double-quoted text, including the empty string `""`. Standard JSON
  string escapes work: `\"`, `\`, `\n`, and `\u2665`, for example. Single quotes,
  unquoted names, raw multiline strings, and trailing content are invalid.

Arrays, objects, `null`, and custom values are unsupported. `*set` cannot change
an established type: assigning `0.5` to an initially integer variable works;
assigning `"0.5"` or `true` to it does not. `*add` requires both a numeric variable
and a numeric literal. `*set count other_count`, `*add count 1 + 2`, and
`*set count ${other_count}` are errors. No arithmetic expressions, variable
operands, interpolation in assignments, or general evaluator are implemented.
A quoted string such as `"${other_count}"` is just a literal string.

## Text input and character creation

`*input_text character_name "Character name" -> choose_background` offers a
single-line field and Continue submit button after the passage's narrative.
`character_name` must already be declared as a string variable. The label must
be a nonempty double-quoted JSON string (nonempty after trimming), with the same
escapes as other literals. Labels are literal text: `${...}` does not interpolate,
and `->` inside the quoted label is ordinary text. The arrow outside the label
must name one existing explicit destination. Both references are validated even
in unreachable passages.

Input is one concluding action category. It cannot coexist with `*choice` or
`*continue`, appear before the title/prose, repeat within a passage, or be wrapped
by a narrative condition. No prose, effects, or further actions may follow it in
the passage. A new passage, a chapter boundary, or EOF finishes the passage under
the existing rules. Every input passage still needs unconditional prose.

Player text is not a script literal: players enter names without quotes/escapes.
The engine's shared validator requires an actual string, rejects line breaks and
C0/C1 controls (including tabs and Unicode line/paragraph separators), and checks
for these before trimming so edge controls are rejected too. It then trims outer
whitespace and requires **1–80 Unicode code points**. Internal spacing,
capitalization, punctuation, and Unicode are preserved. `Alexander`, `Mary Jane`,
`O'Brien`, and `Mary-Jane` are valid; ` Alexandra ` stores `Alexandra`. Emoji use
code points rather than UTF-16 units; combining sequences count each code point.
Empty, whitespace-only, overlong, multiline, and non-string submissions fail.
There is no linguistic validation or interpretation as commands, HTML, code,
interpolation templates, or expressions.

`Game.submitText(value)` uses only the current passage's authored variable and
destination. Ordinary `navigate()` cannot bypass input; submission outside an
input passage fails unchanged. Accepted text enters candidate variables **before
destination entry effects**. Journal interpolation can immediately record the
name, and narrative/choice conditions see post-entry values. All existing effects
retain their order; an authored `*set` can replace the string normally. If any
destination effect fails, the entire submission rolls back, including variables,
passage ID, skills, inventory, and journal. Failed attempts do not accumulate
changes, and the form remains available for correction or retry.

Character creation needs no special engine. Use ordinary string/numeric variables
for identity and attributes, choices for backgrounds, and existing effects for
skills, inventory, and journal. For example:

```text
*var character_name "Unknown"
*var background "Traveler"
*var influence 0
*var honor 0
*skill diplomacy "Diplomacy"

*passage choose_name
*title Your Name

What name will you use on your journey?

*input_text character_name "Character name" -> choose_background

*passage choose_background
*title Your Practice Route
*checkpoint
*journal introduced "The hero is named ${character_name}."

Welcome, ${character_name}. Choose your practice route.

*choice
  #Raised among Pokémon carers -> carer_origin
  #Trained with field researchers -> researcher_origin

*passage carer_origin
*title A Care Workshop
*set background "Carer"
*add influence 2
*grant_skill diplomacy

${character_name}, your ${background} upbringing taught you the routines of Pokémon care.

*passage researcher_origin
*title Field Research
*set background "Researcher"
*add honor 2

${character_name}, your ${background} training taught you discipline.
```

The shipped optional route returns either background to the center. Names and
attributes stay in `GameState.variables`; acquired skills, inventory, and journal
retain their existing state fields, and definitions remain static story metadata.
There is no CharacterState, attribute-allocation subsystem, or second variable
registry. Initial story entry remains deterministic; submission is a deliberate
player action followed by deterministic destination entry. A later ordinary visit
runs entry effects once again; recorded journal IDs keep their original text.

The browser uses a native labeled form. Enter or its Continue button submits
without reloading, and success focuses the new heading. Invalid input or failed
destination entry shows an accessible text error, keeps the typed value and form,
and returns focus to the field. Unsaved typing belongs only to that field until
submission. Opening Character, Journal, or People does not change or submit it.
Rendering and state reads never resubmit text. All display content uses
`textContent`; HTML-like input remains inert.

The checkpoint at the marked input destination contains the accepted name before
its effects, so engine restoration there does not ask for it again. A checkpoint
that starts at a genuine input passage instead offers its form when rendered and
permits a fresh submission. Stage 7B persists that pre-entry checkpoint; it never
saves input drafts or input history. There is no Undo. Only one text field is supported: no numeric input,
multi-field forms, point-buy, portraits, visual customization, or editable character sheet.

## Conditional choices

A choice can have one condition **after its destination**:

```text
*var influence 4
*var honor 11
*var loyal false
*var faction "guild"

*passage audience
*title Audience
*add influence 1

The instructor awaits your answer.

*choice
  #Request a title -> receive_title [if influence >= 5]
  #Challenge the knight -> duel [if honor > 10]
  #Declare loyalty -> oath [if loyal == false]
  #Speak to the merchant -> merchant [if faction == "guild"]
  #Leave -> departure
```

This excerpt assumes each destination is defined elsewhere in the same file.
The title request is available because entry raises influence from 4 to 5 before
conditions are checked. The unconditional Leave action is the required fallback.

A variable condition is exactly one declared variable, one operator, and one literal:

| Operators | Operand types |
| --- | --- |
| `==`, `!=` | Matching numbers, booleans, or strings; strict equality without coercion. |
| `>`, `>=`, `<`, `<=` | Numbers only. |

Conditions use the same names and literals as declarations/effects, including
negative/decimal numbers and escaped double-quoted strings. Whitespace around the
operator is optional. The suffix starts with lowercase `[if` and ends with `]`;
string values may themselves contain brackets, arrows, or operator-like text.
Conditions belong after the destination, never in the label. `[if ...]`-looking
syntax in a choice label is rejected, not silently displayed as prose.

Every block containing a conditional choice needs **at least one unconditional
choice**, even if a condition starts true. A second conditional choice is not a
fallback. All destinations must exist, including those of false conditions.
Continue and terminal passages are unaffected, and conditional Continue is
unsupported.

Authored choices remain in immutable story data. The game exposes only currently
eligible ones to the renderer, so unavailable choices are hidden entirely.
Eligibility uses committed values after entry effects, never initial declaration
values or DOM state. Evaluating choices or rerendering never applies effects.
A later legitimate re-entry applies its effects once and recomputes eligibility.
The runtime also enforces conditions when navigating; bypassing a hidden option
cannot change state. A choice may use both one `[set name literal]` and one `[if ...]` or `[selectable_if ...]` suffix, in either order. The assignment is applied only after the player commits the selected option; browsing or highlighting a choice never changes state. Checkpoints capture the assigned pre-entry state and failed destination effects roll back the assignment. Assignments cannot target temporary variables. If choices share a destination, the reader passes the selected Choice object to `navigateChoice`; `navigate(destinationId)` remains available for unique destinations and Continue, but rejects an ambiguous destination rather than guessing. Preflight replays all options to a shared destination separately.

Unsupported: variable-to-variable comparisons and arithmetic.
Boolean and/or/not, parentheses and indented if/elseif/else are supported.
For example, `[if influence >= other]`, `[if influence + 1 >= 5]`, and
`[if influence >= 5 && loyal == true]` are errors. Type mismatches such as
`[if loyal == 0]`, ordered strings such as `[if faction > "guild"]`, non-finite
numbers, missing operands/brackets, duplicate `[set]`/condition suffixes, and invalid operators are also
rejected with passage/source-line errors before gameplay can start.

### Choice assignments and shared passages

A choice can set one declared **global** variable and navigate directly to a shared passage.
Use this when the response differs but the narrative immediately rejoins:

```text
*var rival_response "none"

*passage gangway
*title The Gangway

Someone pushes past you.

*choice
#Confront him -> arrival [set rival_response "confront"]
#Ignore him -> arrival [set rival_response "ignore"]

*passage arrival
*title Lezano Waterfront

*show_if rival_response == "confront"
You call out to him.

*show_if rival_response == "ignore"
You let him pass without answering.

You step onto the wharf.
```

The reader preserves the selected choice even if both destinations are `arrival`.
Assignments are typed like `*set` and applied atomically before destination entry
effects, the checkpoint boundary, and conditional narrative evaluation. Use
`navigateChoice(choice)` in integrations; `navigate(destinationId)` deliberately
rejects ambiguous same-destination options. No automatic transition passages or
implicit page skips are required. The `*show_if` paragraphs and the shared
paragraph appear together on the arrival page.

## Conditional narrative

`*show_if` uses exactly the same condition grammar and comparison semantics as
choices, without the `[if ...]` brackets. It applies exclusively to the next
paragraph:

```text
*var influence 4
*var loyal false

*passage care_center
*title The Care Center
*add influence 1

The instructor studies your arrival.

*show_if influence >= 5
The instructor recognizes your achievements.
The instructor welcomes you into the Pokémon care team.

Everyone awaits your answer.

*show_if loyal == true
The guards recognize your oath.
```

Entry raises influence to 5, so both lines in the instructor's welcome form one visible
paragraph. The guards' paragraph is hidden. The surrounding ordinary paragraphs
are unconditional. Strings work too, for example `*show_if faction == "merchant"`
when `faction` has been declared. All six operators use the same typed rules,
finite literals, and parser/evaluator as choice conditions.
The skill forms `*show_if has_skill id` and `*show_if lacks_skill id` use that
same parser/evaluator and all the paragraph boundary rules below.
The item forms `has_item id`, `lacks_item id`, and `item_count id operator quantity`
also work after `*show_if` with these same boundaries.

Boundary rules:

- Put `*show_if` after the passage title and all entry effects, before choices
  or Continue. If prose precedes it, a blank line must separate that paragraph
  from the directive; it cannot split consecutive lines of existing prose.
- The next physical source line must begin nonblank narrative prose. A blank
  line, EOF, another `*show_if`, or any other directive there is an error.
- Consecutive prose lines join with spaces and share the condition. A blank
  line ends that paragraph and resets visibility to unconditional for subsequent
  ordinary prose. Another `*show_if` requires a separate paragraph boundary.
- Navigation, the next passage, or EOF can also conclude the final paragraph
  normally. There is no closing command, nested block, `*else`, or `*endif`.
- Conditions cannot wrap `*set`, `*add`, choices, Continue, input, or other commands.
  Effects after narrative remain invalid. `*show_if` is also invalid before a
  title, inside a choice block, or after Continue.
- Every passage needs at least one unconditional narrative paragraph, even if
  all conditions initially pass. No fallback text is generated automatically.

`game.passage.paragraphs` stores immutable `{ text, condition? }` records.
`game.visibleParagraphs` filters them using committed post-entry variables, skills, and inventory, just
as `game.availableChoices` filters actions. The browser uses this runtime view;
hidden paragraphs create no elements or spacing. Visibility does not alter state,
rerun effects, or change navigation. Legitimate re-entry applies its effects once
and then derives visibility from the resulting state.

Visible conditional prose supports `${name}` interpolation with that same state.
Placeholders remain in authored records, substitution is single-pass, and display
uses `textContent`. HTML-like inserted strings stay literal. All interpolation
references and conditions are validated before play, including hidden paragraphs;
a false condition cannot conceal an invalid variable reference.

Malformed conditions, undeclared variables, incompatible types, misplaced
directives, empty conditional paragraphs, and passages with no unconditional
prose produce source-line/passage errors. Boolean combinations and conditional effects are supported; arithmetic and
variable-to-variable comparisons remain unsupported.

## Entry effects

Effects run once, in source order, on entry. For example:

```text
*var count 0

*passage arrival
*title Arrival
*add count 2
*journal first_gain "Count first rose to ${count}."
*set count 10
*add count -0.25

Count: ${count}.
```

This displays `Count: 9.75.`, while the journal retains `Count first rose to 2.`.
Effects must be after `*title` and before the first
narrative line, even if blank lines separate the sections. They cannot appear
between paragraphs, inside choice blocks, or after Continue. Initial entry uses
the same rules as navigation. A legitimate later return to a passage applies its
effects once again; merely reading or rerendering it does not.

Every entry is atomic. An overflow in any addition rejects the whole transition,
even if a later effect would repair the value. Previous state and all its values
remain intact, including inventory, acquired skills, and journal entries. A failed initial
entry does not start a game. No effect reads the
browser UI or performs external actions.

## Interpolation and literal content

Narrative `${name}` placeholders use the current values after all entry effects.
Booleans display as `true`/`false`, numbers as their normal string form, and strings
as their contents without quotes. Placeholders must fit on one source line and
contain exactly a declared name, without spaces or expressions. Unknown names,
`${count + 1}`, and unclosed `${count` are validation errors, including in
unreachable passages. Immutable source text keeps its placeholders.

Interpolation is a single read-only substitution pass. If a variable contains
`<em>${other}</em>`, that entire string is displayed as literal text; it does not
execute HTML or recursively interpolate `other`. Titles, choice labels,
chapter labels, input labels, skill/item display names, and variable/condition literals never interpolate; `${unknown}`
there remains literal text. Journal templates resolve once when first recorded.
All display content uses `textContent`, so HTML and JavaScript are never executed.
Markdown stays literal; the documented [b]/[i] formatting uses safe DOM nodes.

## Whitespace and stable IDs

Source lines lose leading/trailing whitespace; internal spacing is retained.
Consecutive narrative lines join with one space between lines. Indentation does
not imply nesting; all choices are peers. Whitespace around `->` is optional,
and labels cannot contain another `->`. A condition's quoted string may contain
`->` without creating another choice. Blank lines around passages are harmless.
LF, CRLF, CR, and a leading UTF-8 BOM are accepted.

Directives are case-sensitive. Lines beginning with `*` are reserved for supported
directives; unknown ones are errors. Outside choice blocks, `#` is literal prose,
so Markdown headings appear as text. `*comment text` is an author-only comment; `#` never hides narrative. Inline directive-looking text is not
executed.

Keep stable passage IDs when editing prose, changing titles, or moving passages.
Moving the first passage changes where play begins; moving other passages does
not affect navigation. Changing an ID changes passage identity, so update every
reference. Checkpoint restoration relies on these IDs; incompatible releases must
bump the configured story revision as described above. Forward
passage references are valid, and all destinations are checked before play.

## Common errors

| Invalid input | Fix |
| --- | --- |
| Duplicate `*passage city_gate` | Give each passage a unique stable ID. |
| `*passage Center Visit` | Use `city_gate`, matching the identifier grammar. |
| Missing `*title` or two titles | Supply exactly one nonempty title. |
| `*checkpoint` with arguments, twice, or after effects/prose | Place one no-argument marker immediately after the title. |
| `*death` before prose, with another action, or with `*checkpoint` | End a non-start, non-checkpoint passage with one no-argument death action after narrative. |
| A title with no narrative | Add at least one nonblank paragraph. |
| Empty chapter or no following passage | Supply a nonempty label and at least one passage per declaration. |
| Variables, skills, or items after `*chapter` | Move all definitions before chapter metadata. |
| Duplicate item ID or empty item name | Use a unique item ID and a non-whitespace double-quoted name. |
| `*add_item unknown 1` or `has_item unknown` | Declare that item in the initial metadata section. |
| `*remove_item gold_coin 0` or `*add_item gold_coin 1.5` | Use an explicit positive safe integer in decimal digits. |
| `item_count gold_coin >= influence` | Compare item counts with nonnegative safe integer literals. |
| Duplicate skill ID or empty skill name | Use a unique skill ID and a non-whitespace double-quoted name. |
| `*grant_skill unknown` or `has_skill unknown` | Define that skill in the initial metadata section. |
| `has_skill diplomacy >= 1` | Skills are binary; use only `has_skill diplomacy` or `lacks_skill diplomacy`. |
| Duplicate journal event ID | Use one unique ID per authored journal effect; runtime re-entry deduplicates it. |
| `*journal event Text` | Supply a double-quoted string and declared interpolation references. |
| `*var count 0` inside a passage | Move declarations to the beginning of the file. |
| `*stat missing "Name"` or a duplicate stat variable | Declare the variable earlier with `*var` and select it only once. |
| `*stat influence ""` or a stat after `*chapter` | Use a non-whitespace JSON-string label in initial metadata. |
| `*set missing 1` or `${missing}` in narrative | Declare that variable first. |
| `*set count "two"` for a number | Keep the declared type. |
| `*add loyal 1` for a boolean | Only add numeric literals to numeric variables. |
| Effects after narrative or navigation | Move them between the title and first paragraph. |
| `#Go to center` inside a choice block | Use `#Go to center -> center`. |
| `# -> center` or an empty `*choice` | Provide at least one nonempty label with an explicit destination. |
| An action to `unknown_hall` | Define that passage or correct the destination. |
| Continue after choices | Use either choices or Continue in that passage. |
| `*input_text count "Name" -> end` for a number | Target an already declared string variable. |
| Input before prose or alongside choices/Continue | Use one input action after all narrative, concluding the passage. |
| Empty input label or missing input destination | Supply a non-whitespace JSON-string label and an existing explicit ID. |
| `[if influence >= other]` | Compare with a literal, not another variable. |
| A conditional block with no unconditional option | Add a fallback choice. |
| A condition before `->` or malformed brackets | Put exactly one valid `[if name operator literal]` suffix after the destination. |
| A blank line or command immediately after `*show_if` | Start prose on the very next source line. |
| `*show_if` between prose lines | End the previous paragraph with a blank line first. |
| A passage containing only conditional prose | Add at least one unconditional narrative paragraph. |
| Nested `*choice` | Keep choices flat; *if and *comment are supported. |

Errors include one-based source lines and passage IDs when available. Missing
titles point to their passage headers; missing destinations point to their
referring actions. No partially validated story can initialize a game.

## Preflight and playtesting

Before publishing, run `npm run check:stories` for both bundled examples, or
`npm run check:stories -- "path/to/my adventure.story"` for your own file.
The command validates syntax/references with the normal parser, then supplements
that with read-only graph checks and bounded gameplay exploration. It does not
add commands, suppress entry effects, edit your story, or change saves.

- **Errors** include source-line parser failures and concrete eligible routes
  whose entry effects actually failed. For example, `start -> reward -> pay` is
  replayed through the same Game navigation as the browser. Input steps print
  their submitted value. Follow the route and check the destination's spending,
  overflow, and eligibility. Earlier grants count: a removal larger than the
  starting inventory is not automatically an error.
- **Warnings** highlight structurally unreachable passages and cycle passages
  with repeatable numeric/item effects. Check whether an incoming link is missing,
  or whether repeated rewards/expenses are intended. A checkpoint does not turn
  entry effects into one-time rewards. A journal-only return visit can be safe
  because event IDs already deduplicate; cycles are not automatically bugs.
- **Information** aggregates successful/failed return probes and explains
  substituted text, skipped returns, limits, and scope. A successful repeated
  reward remains intentional gameplay unless a real transition fails.
  The tool submits `"Preflight Reader"` wherever text input is encountered.
  Playtest other names, especially if string conditions depend on them.

Structural checks consider all conditional choices potentially traversable.
Structurally unreachable means there is no authored path even with that assumption.
A structural path does not establish that the player can satisfy its conditions.
Normal endings and death terminate exploration and are not errors by themselves.

Exploration follows currently eligible choices, Continue, and text input using
Game. Ordinary paths remain simple, but each eligible first return can now be
probed by replaying its entire route, including the repeated passage ID.
After a successful return, the tool rechecks available actions and can test
each eligible exit to an unvisited passage in a separate one-transition prefix.
It stops there. An exit requiring another repeated entry is outside coverage.

Ordinary entries, return probes, and these immediate exits share one 2,000-prefix
budget. Reports count executed prefixes and distinct attempted/successful returns.
Budget omissions are explicit; successful return summaries do not assert that
all subsequent choices are safe. For a reproduced failure, follow the full route,
including repeated IDs and any printed input value. Re-entry may legitimately
grant rewards, spend items, update checkpoints, or change available choices.
The tool uses the existing engine to discover these consequences.

Longer loops, later continuations after an immediate exit, other text values,
checkpoint restoration, and death recovery remain untested. A clean report is not a safety
guarantee. Use the existing route-test style and manual playtests to check
revisits, recovery, resource promises, and alternative input values.
The TypeScript `analyzeStory(story, maxRoutes)` API can increase the limit for a
targeted review; it still permits only one repeated entry per route and one immediate exit.

## Future functionality, not current syntax

Further character features and arithmetic expressions remain
future work. Read-only character statistics, chapters, the journal, binary skills, inventory quantities,
text input for story-driven character creation, in-memory checkpoints,
persistence/startup, and death/Try Again recovery
are implemented. Snapshots include complete variables, journal, skills, and
inventory; definitions stay in static `Story` metadata.

Stage 8A's selected-stat panel and Stage 8B's responsive reading styles are
implemented. Stage 8C adds permanent browser tests without changing authoring
syntax or gameplay. Stage 8D adds the independent
[Harbor Practice story/playtest](../examples/harbor-practice.md) using this
syntax. Stage 9A adds application-level save identity configuration without new
syntax. Stage 9B adds the static browser story library without altering either
story or this language. Stages 9C–9D add authoring preflight and bounded return probes without new syntax.

Continue Game resumes the latest committed passage when reopening, and New Game confirms
before replacing saved progress. Checkpoint startup began in Stage 7B; last-passage resume is Stage 12A.

There will be no traditional Undo, choice-history stack, manual rewind, Return to
Checkpoint control, manual saves, or save slots. `*death`, guarded Try Again,
the `*checkpoint` marker, engine recovery, versioned browser persistence,
and startup controls are supported.
See `docs/ENGINE.md` for the checkpoint boundary. Current `*continue id` remains
ordinary navigation.

Random mechanics, glossary, shops, skill purchasing, manual saves, save slots,
import/export, procedures, subroutines, loops, and plugin systems remain excluded
unless a future task explicitly changes the requirements.


## Compact reading views and deliberate choices (Stages 10B–10C)

The browser presents five tabs: Story, Character, Party, Pokédex, People.
They remain in one row at 320px with at least 44px targets. An opaque CSS sticky wrapper holds the tabs and a compact bar
showing the current passage's authored chapter only in Story. Passage titles
remain in scrollable content, centered and approximately 10% larger. Chapter text
is centered with compact padding; prose stays left-aligned. Tabs have slightly
larger labels and one bottom-border indicator, with no text underline in any state.
Focus clears the sticky header. Library/startup
screens keep the Aurelian League identity and show no invented chapter. One active content
view uses the same centered column at every viewport width. Native
buttons expose aria-pressed; hidden subtrees are removed from keyboard and
assistive navigation. Information headings receive focus on selection; Story
returns focus to the passage heading. This is presentation only, with no new
story directives or persisted state.

The shared reader retains the story DOM while information is shown, so unsubmitted text,
validation errors, and selected choices survive. It refreshes only the selected read-only view through
panels.ts. View selection never runs GameSession actions, rerenders the passage,
or touches storage. Save warnings stay outside the hidden content. New Game is
confined to startup after reload.
Successful navigation/input/retry rebuild the passage and select Story. Checkpoint
and save compatibility remain unchanged. The muted palette uses system fonts;
there are no animations, overlays, sidebars, or separate mobile navigation.

Character contains selectable Stats (default), Skills, Inventory and Journal,
preserving authored statistics, acquired skill/item order and journal chapter groups.
These are presentation choices only; they never change state, drafts or saves.
People uses optional validated immutable definitions associated through each
`src/catalog.ts` entry. Each person has a stable ID, name, introductory description,
and `discoveryEvents` listing one or more actual journal event IDs. An optional
`facts` list contains `{ "text": "...", "discoveryEvents": ["event_id"] }` entries,
each revealed only after its event occurs. All person and fact event references are
validated against the selected story. The introductory description should contain
only details visible at first meeting; facts from optional conversations should not
appear until that route is visited. The People panel derives both names and learned
facts from the committed journal, so saves, reloads, and checkpoint recovery need
no separate tracking fields. Authors add explicit `*journal` events to the relevant
passages rather than detecting facts from prose or exposing future information.

Authored `*choice` options use a native radio group followed by Continue. No choice is
preselected; Continue stays disabled until selection. Tab enters the group, Space
selects, and arrow keys change selection. Tab to Continue and Enter/Space advances to
the existing authored destination. Selecting alone never executes effects,
captures checkpoints, navigates, or reads/writes saves. Information views retain
the choice; reload discards it. Successful navigation resets selection; failure
retains it with the existing accessible error. Eligibility and effects still belong
to Game. `*continue`, text-input submission, and Try Again remain single actions;
terminal passages have no Continue. Confirmed New Game behavior is unchanged.

## Pronoun tokens (Stage 12B)

Narrative paragraphs and `*journal` text support exactly these tokens and their
initial-capital forms (`{They}`, `{Them}`, `{Their}`, `{Theirs}`, `{Themself}`):

| Token | Declared string variable |
| --- | --- |
| `{they}` | `pronouns_subject` |
| `{them}` | `pronouns_object` |
| `{their}` | `pronouns_possessive` |
| `{theirs}` | `pronouns_possessive_pronoun` |
| `{themself}` | `pronouns_reflexive` |

Declare each variable needed by the tokens you use. Missing or non-string values
produce a source-line parser error; the runtime also validates substitutions.
There is no silent default. Capitalized tokens uppercase the first letter of the
configured value. Ordinary `${variable}` interpolation still works. Unknown/literal
braces such as `{weather}`, `{THEY}`, and `{lord}` stay literal. Substitution is one
pass: values containing token-looking text or HTML are displayed as plain text,
never reinterpreted. Tokens are not expanded in titles, choice labels, or input
labels. Journals resolve when recorded and retain that text through later pronoun
changes, saves, and resume; current narrative uses current variable values.

Use existing choices and sets for creation; no overlay or special character state
is needed. This complete playable template supports three presets:

<!-- pronoun-template -->
```text
*var pronouns_subject "they"
*var pronouns_object "them"
*var pronouns_possessive "their"
*var pronouns_possessive_pronoun "theirs"
*var pronouns_reflexive "themself"
*var use_plural_verbs true
*var honorific "Captain"
*var gender "Unspecified"

*passage creation
*title Choose Pronouns
Choose how the story refers to you.
*choice
#He / him -> he
#She / her -> she
#They / them -> they

*passage he
*title He / Him
*set pronouns_subject "he"
*set pronouns_object "him"
*set pronouns_possessive "his"
*set pronouns_possessive_pronoun "his"
*set pronouns_reflexive "himself"
*set use_plural_verbs false
Your pronouns are set.
*continue arrival

*passage she
*title She / Her
*set pronouns_subject "she"
*set pronouns_object "her"
*set pronouns_possessive "her"
*set pronouns_possessive_pronoun "hers"
*set pronouns_reflexive "herself"
*set use_plural_verbs false
Your pronouns are set.
*continue arrival

*passage they
*title They / Them
*set pronouns_subject "they"
*set pronouns_object "them"
*set pronouns_possessive "their"
*set pronouns_possessive_pronoun "theirs"
*set pronouns_reflexive "themself"
*set use_plural_verbs true
Your pronouns are set.
*continue arrival

*passage arrival
*title A New Arrival
*journal arrived "{Their} journey began at the gate."
The guard welcomes ${honorific}.

*show_if use_plural_verbs == true
{They} are ready to begin.

*show_if use_plural_verbs == false
{They} is ready to begin.
```

Authors can add other presets with any string values through `*set`. Gender stays
an independent ordinary variable: choosing pronouns does not change or infer it.
Honorifics are independent too; use `${honorific}` rather than a special token.
There is no automatic verb conjugation. `use_plural_verbs` above is an ordinary
author-controlled boolean, not an engine rule; choose appropriate conditional
paragraphs for custom pronouns and language. Adding variables to a published story
can require a story revision change under existing save-compatibility rules;
this feature does not alter shipped stories, save schemas, or revisions.

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

Format 5 stores validated page/temp `context` together with current state and the
independent checkpoint. Plain passages use format 4. Formats 1–3 are incompatible
with party state. Missing context for an authored paged/temp passage is rejected,
not guessed. Page targets must be visible authored pages, and temp fields/types
must exactly match declarations. Page advancement never repeats party entry effects.

Preflight advances through visible pages without replaying effects, then explores
only enabled routes. Analysis is bounded; it does not prove all loops/resources or
all possible input-dependent grammar. Use local playtests alongside diagnostics.

## Pokédex encounter events

Pokédex discovery uses existing `*journal` events and separate incremental species
metadata, with no new story directives or save fields. Use an explicit event only
for a witnessed encounter, and pair acquisition events with `*add_pokemon` in the
same entry/guard. Mentions, images and jewelry never count. See
[AUTHORING.md](AUTHORING.md#adding-discoverable-pokédex-species) for the full JSON
contract, acquisition examples, page timing and recovery/compatibility rules.
The nonempty `*title` requirement and internal passage ID semantics are unchanged.

## Ordered chapter sources and completed Pokédex presentation

The public story is assembled eagerly from the ordered
`content/aurelian-league/sources.json` list: globals, Chapter 1 and Chapter 2.
One complete source still enters the existing parser and one Game/session;
no dynamic loading or per-chapter state/save exists. The pure story-source helper
normalizes file boundaries and maps parser diagnostics to a filename/local line.
CLI checks of any public member validate all sources; editor diagnostics use
open buffers, and author preview has a public chapter button with memory saves.

The Pokédex respects the optional global dex_installed flag, with legacy fixtures
without it remaining usable. Only authored lookup records unlock public species.
Metadata preserves optional National number, types, category, official summary,
HTTPS source URL and frozen eventId/text observations. Derived entries include
only journal-recorded notes in journal order. Native details/summary controls start
collapsed and display this data without changing state or storage.

In-story cards require a scanned_ effect authored in the current passage and its
committed journal record. They use the shared safe DOM renderer, show only the
current scan's observations, and never execute effects or re-evaluate guards after
entry. No new directive is needed. The restaurant delay/Livia consequences remain
author-controlled and unchanged. See AUTHORING.md for the full contract/examples.

The original physical split preserved its source and semantics. Renaming Chapter 2
to Arrival then advances the public story to revision 9, because saved journal
entries require their original chapters to match authored chapter labels.
Existing revision-8 saves are rejected, not migrated. GameState, save formats,
story ID, storage key, and checkpoint semantics are unchanged.

## Inline Pokédex presentation directive

`*pokedex species_id` anchors a read-only lookup card at a narrative boundary.
It supports ordinary narrative block guards, `*show_if`, and page-local placement.
It requires matching metadata and a passage-local recorded `scanned_` event;
it does not perform discovery. Repeated species markers and ambiguous shared scan
mappings are rejected. A marked species is excluded from legacy appended cards
throughout that passage. Unmarked species retain legacy behavior. See
[AUTHORING.md](AUTHORING.md#inline-scan-cards) for syntax, metadata and diagnostics.
