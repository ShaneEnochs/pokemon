# The Aurelian League

Narrative planning is advisory. The author's latest explicit instructions take
precedence over earlier notes. Characters, locations, mysteries, relationships,
chapter plans and even playable details may be revised at the author's direction,
without special justification. Review continuity implications rather than rejecting
creative changes. Unwritten scenes and arcs are proposals, not automatic canon.
This flexibility does not weaken engine, validation, scripting or save safeguards.

**Implemented** describes current playable content, **Working** describes intentions
and proposals, and **Archived** preserves earlier ideas for possible reuse. These
labels describe status, not permission to change material. Relaxing these notes
does not automatically restore an older storyline.


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


A Pokémon interactive-fiction mystery set in Aurelia, a remote Roman-influenced
region. You play a junior Aurelian League field warden who believes their work
helps wild Pokémon. The League's public competition conceals a Team Rocket
operation the protagonist has yet to discover.

**Playable now: Chapter 1, A Simple Assignment.** You and senior warden Cassius
pursue an elusive Chikorita through orchards and farmland outside Lezano.
Your choices shape your relationship with Cassius and your approach to the
capture. The chapter ends with the Chikorita in a carrier. Chapter 2 is not
written or linked yet.

The engine's party, inventory, journal, People and Pokédex systems remain available
for future chapters. Chapter 1 starts with a field collection kit in Inventory;
it has no starter selection, owned Pokémon, Pokédex scan or trainer-name input. See the [story bible](docs/STORY_BIBLE.md),
[character bible](docs/CHARACTERS.md), and
[working outline](docs/STORY_OUTLINE.md) for the developing narrative. The planned
new opening begins on April 4, with the inaugural League season set for August;
the first-day interview chapter has not yet replaced the playable Chikorita chapter.

## Install, run, and play

Requires Node.js **22.12+** and npm. Use the existing checkout.

```sh
npm ci
npm run dev
```

Vite prints the local address. Select New Game, read each passage, and use Continue.
Choice menus require selecting an option before Continue. Text input accepts 1–80
Unicode code points, trims outer whitespace, and rejects controls and line breaks.

The three read-only primary views are Story, Inventory, and Pokédex.
Inventory is directly accessible; statistics and party state remain hidden. Chapter 1 shows the junior
field-warden occupation and the seven components of the assigned field kit.
Skills, Journal, and People remain validated and tracked by the engine but are
not exposed as navigation tabs or Character sections. The chapter bar appears only
in Story, and `*hide_title` suppresses secondary passage headings visually without
removing their accessible labels. Party remains hidden; its individual IDs, nicknames and six-member limit are retained.
Public Sans loads via the Google Fonts CDN, with system sans-serif fallback.
Tabs stay on one row at narrow widths with 44px touch targets. Opening information
never advances the story, submits a draft, or saves.

## Writing stories

The full language reference is [docs/SCRIPTING.md](docs/SCRIPTING.md); architecture
and state boundaries are in [docs/ENGINE.md](docs/ENGINE.md). The practical editor
and preview guide is [docs/AUTHORING.md](docs/AUTHORING.md).

Stories are UTF-8 `.story` files. Declarations precede passages. Each passage has
an explicit ID/title, narrative paragraphs, and one concluding action category:
choices, Continue, text input, death/recovery, or a terminal ending. Effects go
between the title and prose and execute atomically in source order. There is no
automatic passage fall-through or JavaScript evaluation.

```text
*var trainer_name "Unknown"
*var nickname ""
*pokemon first_piplup "Piplup"

*passage name
*title Your Name
What name will you use?
*input_text trainer_name "Trainer name" -> partner

*passage partner
*title Your Partner
*add_pokemon first_piplup nickname
Welcome, ${trainer_name}. Piplup joins you.
```

`*pokemon id "Species"` declares an **individual**, not a species registry. Two
IDs can share a species. `*add_pokemon id [nickname_variable]` joins that individual
if absent; `*remove_pokemon id` removes it if present. Repeated additions and absent
removals are no-ops. Rejoining after removal appends at the end. Adding a seventh
member rejects the entire passage entry, including earlier variable/item effects.

Nicknames reference declared **global string variables**. Empty string means no
nickname; otherwise the normal text-input validator applies. The resolved nickname
is copied when joining; later variable changes and duplicate additions do not rename
an existing companion. Pokémon are separate from inventory items and trainer skills.

`has_pokemon id` and `lacks_pokemon id` work in `*if`, `*show_if`, and choice
conditions. Definitions, commands, and conditions are validated even in hidden or
unreachable passages. See the public [opening](content/aurelian-league/chapter-01-simple-assignment.story) for
conditional paragraphs, choice assignments, relationship effects and page breaks.

The engine retains variables, skills, item quantities, journal discovery, People,
conditional narrative/actions/effects, checkpoints, automatic saves, text input,
pronoun tokens, safe formatting, passage-local temps, and resumable reading pages.
[Advanced authoring](examples/advanced-authoring.story), [Center Visit](src/example.story),
and [Harbor Practice](examples/harbor-practice.story) are private regression examples,
not additional Aurelia lore or public catalog entries.

## Authoring tools and preview

- [Notepad++ toolkit](tools/notepadpp/README.md): import `Pokemon-udl.xml` and optionally
  `Pokemon.xml` for highlighting/autocomplete; use the saved-file validator.
- [Pokémon Story VS Code extension](tools/vscode-pokemon/README.md): build/package
  locally, then install its VSIX. Workspace `pkmn-` snippets and validation tasks
  work alongside parser-backed diagnostics. `.story` remains the file extension.
- Run `npm run dev`, then use its `/author.html` page to select a local `.story`
  and optional `.people.json`. Files stay in the browser. Preview uses temporary
  memory saves; Restart preview clears them. Re-select files after editing.

The author preview and private browser regression catalog are excluded from the
published build. No editor uploads, accounts, APIs, or new runtime dependencies exist.

## Saves and recovery

The sole public story has `storyId: aurelian-league`, `storyRevision: 12`, and key
`pokemon:checkpoint:aurelian-league`. This fresh namespace never reads, migrates,
or deletes the former game's browser records.

Party-aware progress uses **format 4**, or **format 5** with validated page/temp
context. Formats 1–3 have incompatible state schemas and are rejected. The engine's
checkpoint-only helper uses format 6; the application always writes committed
progress, never checkpoint-only saves.

Continue restores the last committed passage, reading page, temporary values,
variables, party, inventory, skills, and journal **without reapplying entry effects**.
A separate complete pre-entry checkpoint supports Try Again after authored death.
Both boundaries validate party IDs/species, nicknames, uniqueness, and the six-member
limit. Malformed or incompatible progress remains intact until an explicitly
confirmed New Game replaces it. Startup inspection and Continue never write.

Saves are browser/origin-local, not synchronized between devices. Draft text and
unconfirmed choices are not saved. Automatic write failures preserve the in-memory
game and show a warning. Inaccessible storage requires explicit Play without saving
consent. There is no Undo, manual rewind, save-slot manager, or migration UI.

## Validation

```sh
npm test
npm run check:stories
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:author
npm run build:pages
npm ci --prefix tools/vscode-pokemon
npm test --prefix tools/vscode-pokemon
npm run package --prefix tools/vscode-pokemon
```

In this cloud environment, installed Chromium can be used with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` before each browser command.
Restricted command sandboxes may require approved execution outside the sandbox for
CLI IPC, server ports, and Chromium. Keep TLS verification and the platform proxy.

Production browser tests exercise the actual public build on port 4175. The same
command compiles a separate private regression catalog via `vite.regression.config.ts`
and runs the retained recovery/inventory/People/UI suites on port 4176. This catalog
is selected only at build time; there is no test-only app route or runtime switch.
Author tests own development port 4177. Keep these ports free. Rebuild with
`npm run build` after Pages validation before ordinary production browser tests.
Preflight is bounded; a clean report is not proof that every possible route is safe.

## GitHub Pages

Intended deployment: **https://shaneenochs.github.io/pokemon/**.
`npm run build:pages` builds with `/pokemon/` and checks JavaScript/CSS asset paths,
asset existence, and exclusion of authoring code. A successful build does not prove
a live deployment. Set GitHub Pages source to **GitHub Actions** in repository settings.

Pull requests run required checks without deploying. Pushes to `main` deploy only
after player and editor-tool checks pass; Pages/OIDC write permissions are confined to the deployment job.
The separately packaged editor extension is never bundled with the player. Verify
the Actions deployment and the actual site after merging; this task does not merge
or publish automatically.

## Chapter authoring and preview

The public story is assembled from globals and chapter files under
`content/aurelian-league/`, in the single explicit order in `sources.json`.
Globals holds shared declarations; each chapter holds its chapter label and
passages. The application eagerly assembles all text before the existing parser,
so cross-chapter navigation shares one complete Story, Game and save. There is
no runtime chapter loading or new story command. The old ferry and arrival chapters have been replaced by the new Chapter 1.

Run `npm run check:stories` or pass any public chapter to check the complete
ordered story. VS Code diagnostics/tasks and Notepad++ validation use that order;
assembly parser errors include the originating filename and local line. In the
development author preview choose **Preview public chapter files** to play the
same assembled sources with public metadata and private memory saves. Standalone
single-file drafts remain supported.

## People and Pokédex metadata

Chapter 1 automatically records Chikorita as Encountered in the Pokédex when the
opening begins, using an authored journal event and species metadata. It does not
join the Party. Cassius is recorded as a known person at the same point.
Later chapters can add discovery and scan events using the engine's existing
journal-driven metadata system.

Revision 12 adds the opening Chikorita encounter and deliberately invalidates
revision-11 and older saves, so Continue never has to backfill a missing event.
The browser storage key remains `pokemon:checkpoint:aurelian-league`. A confirmed
New Game replaces incompatible progress; the app never silently migrates or
deletes the old save.
