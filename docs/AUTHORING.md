# Local Pokémon story authoring

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


Use UTF-8 `.story` files. Read the full [language reference](SCRIPTING.md) and
[engine boundaries](ENGINE.md). Declarations come first; effects follow a passage's
title/checkpoint and precede prose. The public story is
[the ordered chapter sources](../content/aurelian-league/sources.json). The examples are
private regression fixtures, not extra canon or public stories.

## Editing and validation

Run `npm ci` and `npm run dev` from the repository root. Notepad++ users can import
[Pokemon-udl.xml](../tools/notepadpp/Pokemon-udl.xml) and optionally
[Pokemon.xml](../tools/notepadpp/Pokemon.xml); the toolkit README documents saved-file
validation and optional People JSON. VS Code users can build and locally install
[Pokémon Story](../tools/vscode-pokemon/README.md). `.story` uses language ID
`pokemon-story`; Ctrl+Space and `pkmn-` discover 39 workspace snippets. The extension
uses the same parser for open/save diagnostics; highlighting alone is not validation.

VS Code tasks **Aurelian League: Check Current Story**, **Check Bundled Stories**,
and **Start Local Preview** use process arguments, preserving filenames with spaces.
Alternatively run `npm run check:stories -- "path/to/my story.story"`. Without an
argument, it checks the public opening and three regression examples. Parser and
reproduced runtime errors fail; warnings/scope limits remain advisory. Preflight
is bounded and never proves every possible route safe.

## Private browser preview

Use the local Vite server's `/author.html` page. Select your saved `.story`, optionally
a `.people.json`, then New Game. The shared reader supports the three public views and hidden party state,
input, choices, pages and recovery. Files remain in the browser and saves use private
memory, never public localStorage. Restart preview resets progress. Re-select files
after edits, even with the same name. The passage index searches IDs/titles and
shows authored destinations without navigating the game. No upload, source editing,
automatic registration or publishing occurs. Normal builds exclude author.html.

## Headings and chapter numbering

Author numbered chapter labels as literal `*chapter` directives, for example
`*chapter Chapter 1: A Simple Assignment`. Keep a required `*title` in every
passage. Use `*hide_title` immediately after `*title` on transitional
passages where the large visible heading would interrupt the narrative.
The heading remains available to screen readers and in author tools; it is
only visually hidden. The public opening displays *A Simple Assignment*. Its smaller transition
passages hide their headings.

## Trainer creation and companions

Use a global `trainer_name` string with `*input_text`; use choices and ordinary sets
for the five pronoun strings plus a plural-verb boolean. The current Chapter 1 has not yet introduced name or pronoun selection. The engine retains values selected with `*stat` without displaying a Stats interface; there is no
independent gender/background/class subsystem.

Declare individuals with `*pokemon starter_piplup "Piplup"`. Join with
`*add_pokemon starter_piplup starter_nickname`, where starter_nickname is a declared
global string populated by `*input_text`. Empty means species-name display. The
nickname is copied when joining and does not track later variable changes. Party
holds six; duplicate adds/absent removals are no-ops. `*remove_pokemon id`,
`has_pokemon id` and `lacks_pokemon id` support authored membership changes/guards.
A seventh companion fails atomically. Party never uses inventory items.

## Public configuration and saves

Edit `content/title-page.json` for plain-text brand/title/description/button labels.
Keep all five fields nonempty strings. The catalog contains only The Aurelian League,
identity `aurelian-league`, revision 12, key `pokemon:checkpoint:aurelian-league`.
Display text is not a save identity. The old game's keys are never read or deleted.
Party-aware saves use format 4, or 5 with reading context; schemas 1–3 are incompatible.
Continue resumes committed state/page without re-entering. Checkpoints preserve the
pre-entry boundary for Try Again. Unsubmitted drafts/choices never save. Progress
is browser-local; it does not synchronize across devices. Preview remains temporary.

Run Node, story, build and both browser suites before a publishing PR. Include
intentional revision changes for incompatible declarations/effects. The advanced
example exercises safe formatting, capitalization, pronouns, nested conditions,
temps, disabled choices, pages and recovery. Test longer loops and input variations
separately. Pages deploys only main after checks with `/pokemon/`; neither editor
preview nor the private browser-regression catalog is published.

## Adding people and gradually revealed details

Use `content/aurelian-league.people.json` for public People entries, or an optional
`.people.json` in author preview. Each entry has `id`, `name`, an introductory
`description`, and `discoveryEvents`. The entry appears only after one of those
journal events occurs. To add facts learned later, include optional `facts` entries:

Current public example:

```json
[
  {
    "id": "cassius",
    "name": "Cassius",
    "description": "The senior field warden supervising your assignment.",
    "discoveryEvents": ["met_cassius"]
  }
]
```

The opening records `*journal met_cassius "..."` so Cassius becomes visible in
People immediately. Optional `facts` entries can be added in later chapters
when the story records corresponding new journal events. Keep introductory
descriptions limited to what the player already knows. All referenced event IDs
must exist in the assembled story; unknown references fail validation.

Facts appear as separate entries beneath the character's name and are derived
exclusively from recorded journal events, without another save collection. They
accumulate through conversations, survive ordinary save/reload, do not duplicate,
and disappear on checkpoint recovery if the relevant events are rolled back.
Old saves are not silently backfilled with newly authored events. This feature
does not change the save schema or the current public revision.

## Chapter files: one complete story

The public source order is defined once in `content/aurelian-league/sources.json`:

```text
content/aurelian-league/
  sources.json
  globals.story
  chapter-01-simple-assignment.story
```

Put shared `*var`, `*stat`, `*item`, `*skill` and `*pokemon` definitions in globals.
Put each chapter's literal `*chapter` label and passages in its chapter file.
Add future files to the ordered JSON list after the preceding chapter. All sources
are eagerly imported and assembled before the existing `parseStory` runs. There
is one Story, Game/session, variable set, party, inventory, journal, Pokédex and
save identity. Cross-chapter choices/Continue use normal destination IDs; there
is no import command, runtime chapter request, or separate chapter save.

`npm run check:stories` checks the complete public story plus regression examples.
Passing **any** public member file also checks the complete ordered story:

```sh
npm run check:stories -- content/aurelian-league/chapter-01-simple-assignment.story
```

The VS Code Check Current Story task and Notepad++ saved-file launcher use this
same behavior. The optional VS Code extension assembles all public siblings on
open/save, preferring open document buffers to saved text. Parser diagnostics map
to the originating file and its local line. Standalone private drafts still use
the normal single-file parser. The public source list is intentionally specific
to this game, not a general module/import mechanism.

For local playtesting, run `npm run dev`, open `/author.html`, and select **Preview
public chapter files**. It uses the exact same ordered sources and public People/
Pokédex metadata in a fresh memory-only session. Save edits in your editor; after
Vite reloads, choose the button again. Do not upload an individual chapter as a
complete standalone story. Single-file private draft preview remains available.
The previous contestant-story chapters have been replaced by Chapter 1 of the
field-warden mystery. Its original catalog revision was 10; adding the starting
field kit and occupation advanced it to revision 11. The opening Chikorita encounter
advances it to revision 12. Revision-11 and older saves
are incompatible and are not silently migrated; the story ID, storage key, and
save formats remain unchanged.

## Pokédex installation, lookup events and observations

The three primary views are Story, Inventory and Pokédex. Inventory is directly accessible. People, Journal and Skills stay in engine state and
metadata without visible buttons. Chapter labels appear only in Story. Views, disclosure
controls, and information cards are read-only and preserve choices, drafts and
saved bytes. Entries start collapsed and use native keyboard-accessible details/
summary controls with at least 44px targets. A sole discovered species opens by default; multiple entries start collapsed. Expanded entries show the recorded chapter and, if authored, an optional firstEncounterLocation. Field Notes are not added to the visible Pokédex.

### Automatic encounter registration

Chapter 1 records `encountered_chikorita_orchard` in its opening passage. Chikorita
therefore appears in the Pokédex immediately on New Game, as Encountered, without
joining the Party. The story does not declare `dex_installed`, so the notebook is
available from the start.

To register another species automatically, add its metadata to
`content/aurelian-league.pokedex.json` and put an existing `*journal` effect in
the passage where the protagonist actually encounters it, after the title and
before prose:

```text
*journal encountered_chikorita_orchard "You encountered Chikorita during the relocation assignment outside Lezano."
```

Reference that exact event ID in the species' `discoveryEvents` array. Use a
unique event ID at each encounter passage; multiple IDs can map to the same
species. An event fires only when that passage/guard executes successfully.
Revisiting an event or encountering the species elsewhere still produces one
entry. Species without metadata never produce placeholders, and prose mentions
alone never discover anything. Do not add `*add_pokemon` for encounters: that
command is reserved for actual companions.

The existing journal is the only discovery state. Save/Continue preserves it
without replaying effects; checkpoint recovery retains earlier events and removes
later ones. Taking another branch cannot discover species on an unvisited branch.
No encounter registry, parser command, or save-format change is needed.

Encounter events do not display in-story scan cards. Reserve `scanned_...` for
explicit lookup passages, documented below. If a future story declares
`dex_installed`, the existing installation gate still applies.

Add species incrementally to `content/aurelian-league.pokedex.json`. Example:

```json
[
  {
    "id": "wattrel",
    "name": "Wattrel",
    "nationalNumber": 940,
    "types": ["Electric", "Flying"],
    "category": "Storm Petrel Pokémon",
    "officialSummary": "A short paraphrase based on an official Pokédex source.",
    "description": "Legacy fallback for private fixtures.",
    "discoveryEvents": ["scanned_wattrel_harbor", "scanned_wattrel_emergency"],
    "observations": [
      {"eventId": "scanned_wattrel_harbor", "text": "You watched Wattrel fly above the harbor."},
      {"eventId": "scanned_wattrel_emergency", "text": "You researched Wattrel while it needed urgent help."}
    ]
  }
]
```

Use unique stable lowercase species IDs, separate from individual party IDs.
`name`/`description` are required nonempty literal strings. discoveryEvents is
required (possibly empty); acquisitionEvents is optional. At least one discovery/
acquisition event is needed. Each reference, including every observation eventId,
must be a real journal effect in the selected story. Duplicate species IDs,
duplicate event references within a list, duplicate observation IDs, invalid types
or empty text fail validation. Metadata arrays/records are copied and frozen.

The extra information fields remain optional for legacy fixture compatibility.
When supplied, nationalNumber is a positive safe integer, displayed with at least
four digits (Machoke 0067, Wingull 0278, Minccino 0572, Wattrel 0940). types contains
one or two unique nonempty strings; category/officialSummary are nonempty strings.
Entries display the species description and recorded observations, without trainer guidance.
No official-site links are displayed in either the Pokédex panel or lookup cards.
observations is an array of eventId/text records. Only notes whose journal IDs are recorded appear, in journal recording
order, never all notes from the species definition. Multiple scans still produce
one species entry, and unknown future observations stay hidden. Official summaries
are displayed instead of scene-specific legacy descriptions when available.

A lookup passage uses existing commands only:

```text
*passage harbor_scan_wattrel
*title Looking Up Wattrel
*hide_title
*journal scanned_wattrel_harbor "You looked up Wattrel at the harbor."
You finish your note and close the hologram on your League bracelet.
```

The reader derives an in-story information card from a `scanned_` journal effect
in the current passage **and its committed journal record**. A skipped conditional
scan has no record and no card. Guards are not re-evaluated against post-effect
variables; the recorded result is authoritative. Cards show number/name, types,
classification, official summary and only
observations associated with that passage's recorded scans. Merely seeing or mentioning Pokémon, or visiting a later
non-scan passage, creates no card. Rendering never triggers discovery or a save.
Reopening a committed lookup passage can show its recorded lookup without replay.

For acquisition, pair `*add_pokemon individual_id` with a journal event in the same
entry/guard and reference that event in acquisitionEvents. Acquired status survives
party removal because it reads the journal, not current membership. No species
is silently acquired or researched by the UI.

Urgent scans are decisions with consequences. In the restaurant, choosing to scan
before helping records the delay and leaves Livia disappointed; displaying a card
never repairs or changes those variables/events. Later safe research adds its own
observation without duplicating Wattrel or erasing the earlier choice.

The journal remains the sole discovery store. Continue resumes exact recorded
scans without writing; checkpoints restore exactly their recorded observations,
retaining earlier scans and rolling back later ones. There is no new mutable
collection, timestamp, schema, or save-format change. Revision 12 adds the initial
Chikorita encounter event, so revision-11 and older saves require a confirmed New
Game rather than continuing without that event. Saves are never backfilled.
Revision-8 progress is incompatible because the authored chapter label changed.

## Inline scan cards

Use `*pokedex chikorita` on its own line at a blank-line narrative boundary,
after the passage title/entry effects and before navigation. It places the existing
scan card between paragraphs, including on a later `*page_break` page:

```text
*passage scan_chikorita
*title Examining Chikorita
*journal scanned_chikorita_field "You scanned Chikorita."

You raise the device.

*pokedex chikorita

You lower it again.
```

The species must exist in the selected .pokedex.json metadata and reference a
`scanned_` journal effect authored in this passage (discoveryEvents,
acquisitionEvents or observations). Discovery still comes only from committed
journal events; the marker never discovers, saves, grants a companion or executes
an effect. `dex_installed`, committed passage-local scan evidence and unlocked
observations remain authoritative. A guarded scan that did not execute reveals
nothing. An `*if`/`*elseif`/`*else` narrative block or an immediately preceding
`*show_if` can condition the marker. Ordinary unconditional prose is still required in a passage; a card can occupy
a page of its own. Marker conditions use the same committed globals/temps
as prose. Cards appear only on their authored page and remain correct on Continue.

Different species can have markers in the same passage, in authored order. A
repeated species marker in one passage is an error, even across exclusive branches
or pages; use one marker for that species. A scan event mapped to multiple species
is rejected when an inline marker uses it. These rules avoid ambiguous placement.
An inline species reserves its card for the entire passage: no legacy copy appears
at the end, even when that marker's condition is false or its page is not current.
Species without markers keep their existing end-of-passage scan-card behavior.

Standalone CLI/editor validation reads a sibling `draft.pokedex.json` alongside
`draft.story`; public chapters use the public metadata. The parser checks syntax,
placement and duplicate markers; metadata validation checks species, scan links
and ambiguous mappings. The author preview uses its selected metadata file.
No persistent state, public revision or save-format change is introduced.
