# Pokémon Story for VS Code

This local extension registers `.story` as **Pokémon Story**, highlights supported
commands using theme-defined TextMate scopes, and reports the existing parser's
first syntax/reference error on open and save. It does not run preflight, interpret
stories, or modify source files, gameplay, preview behavior, or saved progress.

From the repository root:

```sh
npm ci --prefix tools/vscode-pokemon
npm test --prefix tools/vscode-pokemon
npm run package --prefix tools/vscode-pokemon
```

In VS Code, open Extensions (Ctrl+Shift+X), choose the `…` menu → **Install from
VSIX…**, and select `tools/vscode-pokemon/pokemon-story-0.1.0.vsix`. Reload if
prompted. Open a `.story` document and verify the status-bar language is **Pokémon Story**. Cloning alone does not install the extension. No Marketplace account,
publisher credentials, external service, or publication is required.

Keep the repository folder open to use the existing 38 `pkmn-` snippets (Ctrl+Space)
and three Aurelian League tasks. The workspace snippets are the single source; the extension
does not ship a competing copy. Outside this workspace, copy that snippet file into
your VS Code user snippets if desired. Without the extension, manually select Plain
Text to continue editing with the same snippets; install the extension to use automatic language support.

Save a file containing `*unknown` to see a red squiggle and Problems entry. Clicking
it jumps to the parser's actual line. Fix and save to clear it. Diagnostics preserve
passage IDs/messages, stop at the parser's first error, and clear on close. If an
error has no reliable source line, it is logged in Output → Pokémon Story rather
than assigned an invented range. No idle/keystroke analysis is performed.

Use **Aurelian League: Check Current Story** for full bounded preflight, including advisory
reachability/cycle warnings, reproduced runtime failures, and exploration limits.
Those findings are separate from editor syntax diagnostics.

For extension development, open this directory in VS Code and launch an Extension
Development Host with `code --extensionDevelopmentPath=<absolute path to this directory>`
after building. Validate open/save/correction/close behavior with two story files.
The automated suite exercises the actual TextMate grammar with Oniguruma and the
DiagnosticCollection event wiring using a VS Code API test double. Generated parser
bundles, dependencies, and VSIX packages are ignored by Git.

## Pokémon companions

The public opening is `content/aurelian-league/chapter-01-simple-assignment.story`. Initial declarations support
`*pokemon id "Species"`. Use `*add_pokemon id [nickname_variable]` and
`*remove_pokemon id` as entry effects. The nickname operand must name a global string
(empty means no nickname); it is copied once when joining. Party holds six, with
idempotent duplicate adds/absent removes. Conditions support `has_pokemon id` and
`lacks_pokemon id`. The Party view is read-only. See docs/SCRIPTING.md for validation,
atomicity, saves and the complete syntax. No evolution or battle mechanics exist.

## Public chapter files

Shared declarations live in content/aurelian-league/globals.story; each chapter
has a separate .story source. The fixed sources.json order is the shared source
list. Checking any public chapter through the CLI/task/Notepad++ launcher validates
them together; standalone private stories keep their original single-file behavior.
The VS Code extension also validates public siblings together on open/save, using
open buffers where available and reporting the originating file and line.
For a playable local preview use Preview public chapter files at /author.html;
it assembles the same sources/metadata with temporary memory progress. See
docs/AUTHORING.md for opt-in Pokédex metadata, observations and information cards.

Inline scan cards use `*pokedex species_id` and the `pkmn-pokedex` workspace
snippet. Standalone diagnostics read a sibling `.pokedex.json` metadata file;
public chapter diagnostics use public metadata. Save the story after metadata
edits to refresh validation. Unknown species, missing passage scan links and
ambiguous mappings are errors. See docs/AUTHORING.md for presentation semantics.
