import { formattedParts } from './format';
import { interpolate, selectInline } from './interpolate';
import type { Choice, ComparisonOperator, Condition, ItemDefinition, NarrativeParagraph, PokedexMarker, Passage, PassageEffect, PokemonDefinition, SkillDefinition, StatDisplay, Story, TextInputAction, EffectGuard, Variables, VariableValue } from './types';

import { syntaxError, id, literal, knownPokemon, knownSkill, knownItem, quantityLiteral, parseCondition } from './expressions';
/** Parse and validate the entire story before any passage can be entered. */
export function parseStory(source: string): Story {
  const passages: Passage[] = [];
  const ids = new Set<string>();
  const journalIds = new Set<string>();
  let chapter = 'Prologue';
  let pendingChapterLine: number | undefined;
  const initialVariables: Record<string, VariableValue> = {};
  const skills: SkillDefinition[] = [];
  const pokemon: PokemonDefinition[] = [];
  const items: ItemDefinition[] = [];
  const stats: StatDisplay[] = [];
  const references: { destinationId: string; passageId: string; line: number }[] = [];
  let current: {
    id: string; chapter: string; line: number; temps: Record<string, VariableValue>; title?: string; hideTitle?: true; checkpoint?: true; paragraphs: NarrativeParagraph[]; pokedexMarkers: PokedexMarker[];
    choices: Choice[]; effects: PassageEffect[]; continueTo?: string; textInput?: TextInputAction; death?: true;
  } | undefined;
  let page = 0;
  const blocks: { indent: number; id: number; branch: number; conditions: Condition[]; pending: boolean; otherwise: boolean; bodyIndent?: number }[] = [];
  const allBranches: Condition[][] = [];
  type BranchPath = { id: number; branch: number }[];
  let paragraphPaths: BranchPath[] = [];
  let blockInfo: { id: number; path: BranchPath; conditions: Condition[] }[] = [];
  let explicitShowIf = false;
  const path = (): BranchPath => blocks.map(b => ({ id: b.id, branch: b.branch }));
  const samePath = (a: BranchPath, b: BranchPath): boolean => a.length === b.length && a.every((entry, i) => entry.id === b[i]!.id && entry.branch === b[i]!.branch);
  function guaranteed(parent: BranchPath = []): boolean {
    return paragraphPaths.some(p => samePath(p, parent)) || blockInfo.some(block => samePath(block.path, parent)
      && block.conditions.at(-1)?.operator === 'literal'
      && block.conditions.every((_condition, branch) => guaranteed([...parent, { id: block.id, branch }])));
  }
  function variables(): Variables { return { ...initialVariables, ...current?.temps }; }
  function conjunction(a: Condition | undefined, b: Condition | undefined): Condition | undefined {
    return a && b ? Object.freeze({ operator: 'and', left: a, right: b }) : a ?? b;
  }
  function guard(): Condition | undefined {
    let result: Condition | undefined;
    for (const block of blocks) {
      for (let i = 0; i < block.branch; i++) result = conjunction(result, Object.freeze({ operator: 'not', operand: block.conditions[i]! }));
      result = conjunction(result, block.conditions[block.branch]);
    }
    return result;
  }
  function addEffect(effect: PassageEffect): void {
    const guards: EffectGuard[] = blocks.map(block => Object.freeze({ id: block.id, branch: block.branch, conditions: block.conditions }));
    current!.effects.push(Object.freeze({ ...effect, ...(guards.length ? { guards: Object.freeze(guards) } : {}) }));
  }
  let paragraph: string[] = [];
  let paragraphCondition: Condition | undefined;
  let showIfLine = 1;
  let action: 'choice' | 'continue' | 'input_text' | 'death' | undefined;
  let actionLine = 1;

  function flushParagraph(): void {
    if (current && paragraph.length > 0) {
      try { selectInline(paragraph.join(' '), variables(), true, text => { formattedParts(text); }); formattedParts(paragraph.join(' ')); } catch (error) { throw syntaxError((error as Error).message, current.line, current.id); }
      if (!explicitShowIf) paragraphPaths.push(path());
      current.paragraphs.push(Object.freeze({
        text: paragraph.join(' '),
        ...(page ? { page } : {}),
        ...(paragraphCondition === undefined ? {} : { condition: paragraphCondition }),
      }));
    }
    paragraph = [];
    paragraphCondition = undefined;
    explicitShowIf = false;
  }

  function finishPassage(): void {
    if (!current) return;
    if (paragraphCondition !== undefined && paragraph.length === 0) {
      throw syntaxError('*show_if requires a narrative paragraph on the immediately following source line.', showIfLine, current.id);
    }
    flushParagraph();
    if (page && current.paragraphs.at(-1)?.page !== page && !current.pokedexMarkers.some(marker => (marker.page ?? 0) === page)) throw syntaxError('A page break requires following narrative.', current.line, current.id);
    if (current.title === undefined) {
      throw syntaxError('Passage requires exactly one *title.', current.line, current.id);
    }
    if (current.paragraphs.length === 0) {
      throw syntaxError('Passage requires at least one narrative paragraph.', current.line, current.id);
    }
    if (!guaranteed()) {
      throw syntaxError('Passage requires at least one unconditional narrative paragraph.', current.line, current.id);
    }
    if (action === 'choice' && current.choices.length === 0) {
      throw syntaxError('*choice requires at least one choice.', actionLine, current.id);
    }
    if (current.choices.some(choice => choice.condition !== undefined || choice.selectable !== undefined)
      && !current.choices.some(choice => choice.condition === undefined && choice.selectable === undefined)) {
      throw syntaxError('A conditional choice block requires at least one unconditional choice.', actionLine, current.id);
    }
    passages.push(Object.freeze({
      ...(Object.keys(current.temps).length ? { temps: Object.freeze(current.temps) } : {}),
      id: current.id, chapter: current.chapter, title: current.title, ...(current.hideTitle ? { hideTitle: true } : {}), paragraphs: Object.freeze(current.paragraphs),
      ...(current.pokedexMarkers.length ? { pokedexMarkers: Object.freeze(current.pokedexMarkers) } : {}),
      effects: Object.freeze(current.effects),
      choices: Object.freeze(current.choices),
      ...(current.checkpoint === undefined ? {} : { checkpoint: current.checkpoint }),
      ...(current.death === undefined ? {} : { death: current.death }),
      ...(current.continueTo === undefined ? {} : { continueTo: current.continueTo }),
      ...(current.textInput === undefined ? {} : { textInput: current.textInput }),
    }));
  }

  const lines = source.split(/\r\n|\n|\r/);
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    const text = raw.trim();
    if (/^\*comment(?:\s|$)/.test(text)) {
      if (!text.slice(8).trim()) throw syntaxError('*comment requires text.', line, current?.id);
      continue;
    }
    if (text) {
      if ((blocks.length || /^\s*\*(?:if|elseif|else)\b/.test(raw)) && /^\s*\t/.test(raw)) throw syntaxError('Use spaces, not tabs, for block indentation.', line, current?.id);
      const indent = raw.length - raw.trimStart().length;
      if (paragraphCondition !== undefined && paragraph.length === 0 && text.startsWith('*') && !/^\*pokedex(?:\s|$)/.test(text)) throw syntaxError('*show_if requires a narrative paragraph on the immediately following source line.', line, current?.id);
      const branch = /^\*(if|elseif|else)(?:\s+(.*))?$/.exec(text);
      if (blocks.at(-1)?.pending && indent <= blocks.at(-1)!.indent) throw syntaxError('Conditional block requires an indented body.', line, current?.id);
      while (blocks.length && (indent < blocks.at(-1)!.indent || (indent === blocks.at(-1)!.indent && !branch?.[1]?.match(/^(elseif|else)$/)))) { flushParagraph(); blocks.pop(); }
      const enclosing = blocks.at(-1);
      if (enclosing && indent > enclosing.indent) {
        if (enclosing.bodyIndent === undefined) enclosing.bodyIndent = indent;
        if (enclosing.bodyIndent !== indent) throw syntaxError('Inconsistent conditional body indentation.', line, current?.id);
        enclosing.pending = false;
      }
      if (branch) {
        if (action && action !== 'choice') throw syntaxError('Conditional content cannot follow navigation.', line, current?.id);
        if (!current?.title) throw syntaxError('Conditional blocks require a passage title.', line, current?.id);
        flushParagraph();
        if (branch[1] === 'if') {
          const conditions: Condition[] = []; allBranches.push(conditions);
          blockInfo.push({ id: line, path: path(), conditions });
          blocks.push({ indent, id: line, branch: 0, conditions, pending: true, otherwise: false });
        } else {
          const block = blocks.at(-1);
          if (!block || block.indent !== indent || block.otherwise) throw syntaxError('Unmatched or repeated conditional branch.', line, current.id);
          block.branch++; block.pending = true;
        }
        const block = blocks.at(-1)!;
        if (branch[1] === 'else') {
          if (branch[2]) throw syntaxError('*else takes no arguments.', line, current.id);
          block.otherwise = true; block.conditions.push(Object.freeze({ operator: 'literal', value: true }));
        } else block.conditions.push(parseCondition(branch[2] ?? '', variables(), skills, items, line, current.id, pokemon));
        continue;
      }
      if (blocks.length) blocks.at(-1)!.pending = false;
    }
    if (paragraphCondition !== undefined && paragraph.length === 0 && (text === '' || (text.startsWith('*') && !/^\*pokedex(?:\s|$)/.test(text)))) {
      throw syntaxError('*show_if requires a narrative paragraph on the immediately following source line.', line, current?.id);
    }
    if (text === '') {
      flushParagraph();
      continue;
    }

    if (text.startsWith('*')) {
      const directive = text.split(/\s/, 1)[0]!;
      const argument = text.slice(directive.length).trim();
      if (blocks.length && ['*passage','*chapter','*title','*hide_title','*checkpoint','*temp','*choice','*continue','*input_text','*death'].includes(directive)) throw syntaxError('This directive cannot be conditional.', line, current?.id);
      if (directive === '*pokedex') {
        if (!current?.title || action || paragraph.length) throw syntaxError('*pokedex must be at a narrative boundary after the title/effects and before navigation.', line, current?.id);
        const speciesId = id(argument, 'Pokédex species', line, current.id);
        if (current.pokedexMarkers.some(marker => marker.speciesId === speciesId)) throw syntaxError('Repeated *pokedex species in passage: ' + speciesId, line, current.id);
        const condition = conjunction(guard(), explicitShowIf ? paragraphCondition : undefined);
        current.pokedexMarkers.push(Object.freeze({ speciesId, beforeParagraph: current.paragraphs.length, line,
          ...(page ? { page } : {}), ...(condition ? { condition } : {}) }));
        paragraphCondition = undefined; explicitShowIf = false;
        continue;
      }
      if (directive === '*hide_title') {
        if (argument !== '') throw syntaxError('*hide_title takes no arguments.', line, current?.id);
        if (!current || current.title === undefined || current.hideTitle || Object.keys(current.temps).length > 0
          || current.effects.length > 0 || (current.paragraphs.length + current.pokedexMarkers.length) > 0 || paragraph.length > 0 || action !== undefined
          || current.checkpoint) {
          throw syntaxError('*hide_title must appear once immediately after *title, before effects and prose.', line, current?.id);
        }
        current.hideTitle = true;
        continue;
      }
      if (directive === '*temp') {
        if (!current?.title || current.effects.length || (current.paragraphs.length + current.pokedexMarkers.length) || paragraph.length || action) throw syntaxError('*temp must follow title/checkpoint before effects and prose.', line, current?.id);
        const parts = /^(\S+)\s+(.+)$/.exec(argument);
        if (!parts) throw syntaxError('*temp requires a name and literal.', line, current.id);
        const name = id(parts[1]!, 'Temporary variable', line, current.id);
        if (Object.hasOwn(variables(), name)) throw syntaxError('Duplicate or conflicting temporary variable: ' + name, line, current.id);
        current.temps[name] = literal(parts[2]!, line, current.id); continue;
      }
      if (directive === '*page_break') {
        if (!current?.title || action || argument || (!paragraph.length && !(current.paragraphs.length + current.pokedexMarkers.length))) throw syntaxError('Invalid or misplaced *page_break; no arguments are supported.', line, current?.id);
        flushParagraph();
        if ((current.paragraphs.at(-1)?.page ?? 0) !== page && !current.pokedexMarkers.some(marker => (marker.page ?? 0) === page)) throw syntaxError('Consecutive page breaks are not allowed.', line, current.id);
        page++; continue;
      }
      if (directive === '*chapter') {
        if (pendingChapterLine !== undefined) {
          throw syntaxError('Each *chapter must be followed by at least one passage.', pendingChapterLine);
        }
        if (argument === '') throw syntaxError('*chapter requires a nonempty label.', line);
        finishPassage();
        current = undefined;
        action = undefined;
        chapter = argument;
        pendingChapterLine = line;
        continue;
      }
      if (directive === '*checkpoint') {
        if (argument !== '') throw syntaxError('*checkpoint takes no arguments.', line, current?.id);
        if (current?.checkpoint) throw syntaxError('*checkpoint may appear at most once per passage.', line, current.id);
        if (!current || current.title === undefined || Object.keys(current.temps).length > 0 || current.effects.length > 0 || (current.paragraphs.length + current.pokedexMarkers.length) > 0 || paragraph.length > 0 || action !== undefined) {
          throw syntaxError('*checkpoint must immediately follow *title, before entry effects and narrative.', line, current?.id);
        }
        current.checkpoint = true;
        continue;
      }
      if (directive === '*show_if') {
        if (!current || current.title === undefined || action !== undefined || paragraph.length > 0) {
          throw syntaxError('*show_if must be at a paragraph boundary after the title and effects, before navigation.', line, current?.id);
        }
        explicitShowIf = true;
        paragraphCondition = conjunction(guard(), parseCondition(argument, variables(), skills, items, line, current.id, pokemon));
        showIfLine = line;
        continue;
      }
      if (directive === '*add_pokemon' || directive === '*remove_pokemon') {
        if (!current?.title || (current.paragraphs.length + current.pokedexMarkers.length) || paragraph.length || action) throw syntaxError('Effects must appear after *title and before the first narrative paragraph.', line, current?.id);
        const parts = /^(\S+)(?:\s+(\S+))?$/.exec(argument);
        if (!parts || (directive === '*remove_pokemon' && parts[2])) throw syntaxError(`${directive} requires a Pokémon ID${directive === '*add_pokemon' ? ' and optional global nickname variable' : ''}.`, line, current.id);
        const pokemonId = knownPokemon(parts[1]!, pokemon, line, current.id);
        const nicknameVariable = parts[2];
        if (nicknameVariable && (!Object.hasOwn(initialVariables, nicknameVariable) || typeof initialVariables[nicknameVariable] !== 'string')) throw syntaxError('Nickname must reference a declared global string variable.', line, current.id);
        addEffect(directive === '*add_pokemon' ? { kind: 'add_pokemon', pokemonId, ...(nicknameVariable ? { nicknameVariable } : {}) } : { kind: 'remove_pokemon', pokemonId });
        continue;
      }
      if (directive === '*grant_skill' || directive === '*revoke_skill') {
        if (!current || current.title === undefined || (current.paragraphs.length + current.pokedexMarkers.length) > 0 || paragraph.length > 0 || action !== undefined) {
          throw syntaxError('Effects must appear after *title and before the first narrative paragraph.', line, current?.id);
        }
        const skillId = knownSkill(argument, skills, line, current.id);
        addEffect(Object.freeze({ kind: directive === '*grant_skill' ? 'grant_skill' : 'revoke_skill', skillId }));
        continue;
      }
      if (directive === '*add_item' || directive === '*remove_item') {
        if (!current || current.title === undefined || (current.paragraphs.length + current.pokedexMarkers.length) > 0 || paragraph.length > 0 || action !== undefined) {
          throw syntaxError('Effects must appear after *title and before the first narrative paragraph.', line, current?.id);
        }
        const parts = /^(\S+)\s+(\S+)$/.exec(argument);
        if (!parts) throw syntaxError(`${directive} requires an item ID and quantity.`, line, current.id);
        const itemId = knownItem(parts[1]!, items, line, current.id);
        const quantity = quantityLiteral(parts[2]!, false, line, current.id);
        addEffect(Object.freeze({ kind: directive === '*add_item' ? 'add_item' : 'remove_item', itemId, quantity }));
        continue;
      }
      if (directive === '*var' || directive === '*skill' || directive === '*item' || directive === '*pokemon' || directive === '*stat' || directive === '*set' || directive === '*add' || directive === '*journal') {
        const declaration = directive === '*var' || directive === '*skill' || directive === '*item' || directive === '*pokemon' || directive === '*stat';
        if (declaration && (current || passages.length > 0 || pendingChapterLine !== undefined)) {
          throw syntaxError(`${directive} declarations must precede the first passage and all chapter declarations.`, line, current?.id);
        }
        if (!declaration && (!current || current.title === undefined || (current.paragraphs.length + current.pokedexMarkers.length) > 0 || paragraph.length > 0 || action !== undefined)) {
          throw syntaxError('Effects must appear after *title and before the first narrative paragraph.', line, current?.id);
        }
        const parts = /^(\S+)\s+(.+)$/.exec(argument);
        if (!parts) throw syntaxError(`${directive} requires an identifier and literal value.`, line, current?.id);
        const context = directive === '*journal' ? 'Journal event ID' : directive === '*skill' ? 'Skill ID' : directive === '*item' ? 'Item ID' : 'Variable name';
        const variable = id(parts[1]!, context, line, current?.id);
        const value = literal(parts[2]!, line, current?.id);
        if (directive === '*stat') {
          if (!Object.hasOwn(initialVariables, variable)) throw syntaxError(`Undeclared stat variable "${variable}". Declare it with *var first.`, line);
          if (typeof value !== 'string' || value.trim() === '') throw syntaxError('*stat requires a nonempty double-quoted display label.', line);
          if (stats.some(stat => stat.variable === variable)) throw syntaxError(`Duplicate stat display for "${variable}".`, line);
          stats.push(Object.freeze({ variable, label: value }));
        } else if (directive === '*pokemon') {
          if (typeof value !== 'string' || value.trim() === '') throw syntaxError('*pokemon requires a nonempty double-quoted species.', line);
          if (pokemon.some(member => member.id === variable)) throw syntaxError(`Duplicate Pokémon ID "${variable}".`, line);
          pokemon.push(Object.freeze({ id: variable, species: value }));
        } else if (directive === '*item') {
          if (typeof value !== 'string' || value.trim() === '') throw syntaxError('*item requires a nonempty double-quoted display name.', line);
          if (items.some(item => item.id === variable)) throw syntaxError(`Duplicate item ID "${variable}".`, line);
          items.push(Object.freeze({ id: variable, name: value }));
        } else if (directive === '*skill') {
          if (typeof value !== 'string' || value.trim() === '') throw syntaxError('*skill requires a nonempty double-quoted display name.', line);
          if (skills.some(skill => skill.id === variable)) throw syntaxError(`Duplicate skill ID "${variable}".`, line);
          skills.push(Object.freeze({ id: variable, name: value }));
        } else if (directive === '*journal') {
          if (typeof value !== 'string') throw syntaxError('*journal requires a double-quoted string literal.', line, current?.id);
          if (journalIds.has(variable)) throw syntaxError(`Duplicate journal event ID "${variable}".`, line, current?.id);
          try { selectInline(value, variables(), true); interpolate(value, variables()); } catch (error) {
            throw syntaxError((error as Error).message, line, current?.id);
          }
          journalIds.add(variable);
          addEffect(Object.freeze({ kind: 'journal', id: variable, text: value }));
        } else if (directive === '*var') {
          if (Object.hasOwn(initialVariables, variable)) throw syntaxError(`Duplicate variable "${variable}".`, line);
          initialVariables[variable] = value;
        } else {
          if (!Object.hasOwn(variables(), variable)) throw syntaxError(`Undeclared variable "${variable}".`, line, current?.id);
          if (directive === '*add') {
            if (typeof variables()[variable] !== 'number' || typeof value !== 'number') {
              throw syntaxError('*add requires a numeric variable and numeric literal.', line, current?.id);
            }
            addEffect(Object.freeze({ kind: 'add', variable, value }));
          } else {
            if (typeof variables()[variable] !== typeof value) {
              throw syntaxError(`*set must preserve the declared type of "${variable}".`, line, current?.id);
            }
            addEffect(Object.freeze({ kind: 'set', variable, value }));
          }
        }
        continue;
      }
      if (directive === '*passage') {
        finishPassage();
        const passageId = id(argument, 'Passage ID', line);
        if (ids.has(passageId)) throw syntaxError(`Duplicate passage ID "${passageId}".`, line, passageId);
        ids.add(passageId);
        page = 0; paragraphPaths = []; blockInfo = [];
        current = { temps: {}, id: passageId, chapter, line, paragraphs: [], pokedexMarkers: [], choices: [], effects: [] };
        pendingChapterLine = undefined;
        action = undefined;
        continue;
      }
      if (!['*title', '*choice', '*continue', '*input_text', '*death'].includes(directive)) {
        throw syntaxError(`Unsupported directive "${directive}".`, line, current?.id);
      }
      if (!current) throw syntaxError('Expected *passage before any content.', line);
      if (action !== undefined) {
        if (action === 'death') throw syntaxError('*death must conclude the passage; no further directives are allowed.', line, current.id);
        if (action === 'input_text') throw syntaxError('Text input must conclude the passage; no further directives are allowed.', line, current.id);
        throw syntaxError('Choices and Continue must conclude the passage; no further directives are allowed.', line, current.id);
      }
      if (directive === '*death' && paragraphCondition !== undefined) {
        throw syntaxError('*death cannot appear inside conditional narrative; end the paragraph with a blank line first.', line, current.id);
      }
      flushParagraph();
      if (directive === '*title') {
        if (current.title !== undefined) throw syntaxError('Duplicate *title.', line, current.id);
        if (argument === '') throw syntaxError('*title requires non-empty text.', line, current.id);
        current.title = argument;
      } else if (directive === '*death') {
        if (argument !== '') throw syntaxError('*death takes no arguments.', line, current.id);
        if (current.title === undefined || current.paragraphs.length === 0) {
          throw syntaxError('*death must follow the title and narrative content.', line, current.id);
        }
        if (current.checkpoint) throw syntaxError('A death passage cannot also be a checkpoint.', line, current.id);
        if (passages.length === 0) throw syntaxError('The starting passage cannot be a death passage.', line, current.id);
        current.death = true;
        action = 'death';
      } else if (directive === '*choice') {
        if (argument !== '') throw syntaxError('*choice takes no arguments.', line, current.id);
        action = 'choice';
        actionLine = line;
      } else if (directive === '*input_text') {
        if (current.title === undefined || current.paragraphs.length === 0) {
          throw syntaxError('*input_text must follow the title and narrative content.', line, current.id);
        }
        const parts = /^(\S+)\s+("(?:[^"\\]|\\.)*")\s*->\s*(\S+)$/.exec(argument);
        if (!parts) throw syntaxError('Expected *input_text variable "Label" -> destination_id.', line, current.id);
        const variable = id(parts[1]!, 'Input variable', line, current.id);
        if (Object.hasOwn(current.temps, variable)) {
          throw syntaxError(`*input_text cannot target temporary variable "${variable}"; declare a global string with *var.`, line, current.id);
        }
        if (!Object.hasOwn(initialVariables, variable)) throw syntaxError(`Undeclared variable "${variable}".`, line, current.id);
        if (typeof initialVariables[variable] !== 'string') throw syntaxError('*input_text requires a declared string variable.', line, current.id);
        const label = literal(parts[2]!, line, current.id);
        if (typeof label !== 'string' || label.trim() === '') throw syntaxError('*input_text requires a nonempty double-quoted label.', line, current.id);
        const destinationId = id(parts[3]!, 'Input destination', line, current.id);
        current.textInput = Object.freeze({ variable, label, destinationId });
        references.push({ destinationId, passageId: current.id, line });
        action = 'input_text';
      } else {
        current.continueTo = id(argument, 'Continue destination', line, current.id);
        references.push({ destinationId: current.continueTo, passageId: current.id, line });
        action = 'continue';
      }
      continue;
    }

    if (!current) throw syntaxError('Expected *passage before any content.', line);
    if (action === 'choice') {
      const arrow = text.indexOf('->');
      const label = text.startsWith('#') && arrow !== -1 ? text.slice(1, arrow).trim() : '';
      const destination = arrow !== -1 ? text.slice(arrow + 2).trim() : '';
      const parts = /^([^\s\[]+)(.*)$/.exec(destination);
      if (!label || !parts || parts[1]!.includes('->') || parts[2]!.trim().startsWith('->')) {
        throw syntaxError('Expected #Nonempty choice label -> destination_id.', line, current.id);
      }
      if (/\[(?:if|set|selectable_if)\b/i.test(label)) throw syntaxError('Choice conditions must follow the destination; assignments must also be on the destination side.', line, current.id);
      // Preserve the precise invalid-destination diagnostic for bare malformed IDs.
      if (parts[2]!.trim() && !parts[2]!.trim().startsWith('[')) id(destination, 'Choice destination', line, current.id);
      const destinationId = id(parts[1]!, 'Choice destination', line, current.id);
      let condition: Condition | undefined = guard();
      let selectable: Condition | undefined;
      let assignment: Choice['assignment'];
      let seenCondition = false;
      let suffixes = parts[2]!.trim();
      while (suffixes) {
        // Brackets inside a quoted literal are part of the value, not a suffix boundary.
        const suffix = /^\[((?:[^\]"\\]|"(?:[^"\\]|\\.)*")*)\](?=\s|$)/.exec(suffixes);
        if (!suffix) throw syntaxError('Expected [if condition], [selectable_if condition], or [set variable literal] suffix.', line, current.id);
        const content = suffix[1]!.trim();
        const set = /^set\s+(\S+)\s+(.+)$/.exec(content);
        if (set) {
          if (assignment) throw syntaxError('A choice may assign only one variable.', line, current.id);
          const variable = id(set[1]!, 'Choice assignment variable', line, current.id);
          if (!Object.hasOwn(initialVariables, variable)) {
            throw syntaxError('Choice assignment requires a declared global variable: "' + variable + '".', line, current.id);
          }
          const value = literal(set[2]!.trim(), line, current.id);
          if (typeof initialVariables[variable] !== typeof value) {
            throw syntaxError('Choice assignment must preserve the declared type of "' + variable + '".', line, current.id);
          }
          assignment = Object.freeze({ variable, value });
        } else {
          const conditional = /^(if|selectable_if)\s+(.+)$/.exec(content);
          if (!conditional || seenCondition) throw syntaxError('A choice supports at most one condition suffix and one assignment.', line, current.id);
          seenCondition = true;
          const parsed = parseCondition(conditional[2]!, variables(), skills, items, line, current.id, pokemon);
          if (conditional[1] === 'selectable_if') selectable = parsed; else condition = conjunction(condition, parsed);
        }
        suffixes = suffixes.slice(suffix[0].length).trim();
      }
      current.choices.push(Object.freeze({ label, destinationId, ...(selectable ? { selectable } : {}),
        ...(condition === undefined ? {} : { condition }), ...(assignment ? { assignment } : {}) }));
      references.push({ destinationId, passageId: current.id, line });
    } else if (action === 'death') {
      throw syntaxError('*death must conclude the passage; no further prose or choices are allowed.', line, current.id);
    } else if (action === 'continue') {
      throw syntaxError('Continue must conclude the passage; no further prose or choices are allowed.', line, current.id);
    } else if (action === 'input_text') {
      throw syntaxError('Text input must conclude the passage; no further prose or choices are allowed.', line, current.id);
    } else {
      try { selectInline(text, variables(), true); interpolate(text, variables()); } catch (error) {
        throw syntaxError((error as Error).message, line, current.id);
      }
      if (!paragraph.length) paragraphCondition = conjunction(paragraphCondition, guard());
      paragraph.push(text);
    }
  }
  if (pendingChapterLine !== undefined) throw syntaxError('Each *chapter must be followed by at least one passage.', pendingChapterLine);
  if (blocks.at(-1)?.pending) throw syntaxError('Conditional block requires a body.', lines.length, current?.id);
  finishPassage();
  for (const conditions of allBranches) Object.freeze(conditions);

  const first = passages[0];
  if (!first) throw syntaxError('Story requires at least one *passage.', 1);
  for (const reference of references) {
    if (!ids.has(reference.destinationId)) {
      throw syntaxError(`Missing destination "${reference.destinationId}".`, reference.line, reference.passageId);
    }
  }
  return Object.freeze({ pokemon: Object.freeze(pokemon), startId: first.id, initialVariables: Object.freeze(initialVariables), skills: Object.freeze(skills), items: Object.freeze(items), stats: Object.freeze(stats), passages: Object.freeze(passages) });
}
