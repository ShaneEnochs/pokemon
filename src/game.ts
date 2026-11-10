import { validateContext, visiblePages } from './context';
import type { ResumeContext, Variables } from './types';
import { evaluateCondition } from './condition';
import { interpolate } from './interpolate';
import { validateTextInput } from './input';
import { validateCommittedState, validateSnapshot } from './snapshot';
import type { Choice, GameSnapshot, GameState, NarrativeParagraph, Passage, Story } from './types';

export class Game {
  private temps: Variables = Object.freeze({});
  private page = 0;
  private currentState: GameState;
  private currentCheckpoint: GameSnapshot;

  /** committedState is storage restoration only: validated post-entry data skips entry.
   * New games and checkpoint-only/recovery construction retain normal entry. */
  constructor(private readonly story: Story, options?: { readonly checkpoint: unknown; readonly committedState?: unknown; readonly context?: unknown }) {
    const snapshot = validateSnapshot(options === undefined ? {
      state: { passageId: story.startId, variables: story.initialVariables, journal: [], skills: [], inventory: {}, party: [] },
    } : options.checkpoint, story);
    const next = options !== undefined && Object.hasOwn(options, 'committedState')
      ? validateCommittedState(options.committedState, story)
      : this.enterPassage(snapshot.state);
    this.currentState = next;
    this.currentCheckpoint = snapshot;
    if (options && Object.hasOwn(options, 'committedState')) {
      if (options.context === undefined && (this.passage.temps || [...this.passage.paragraphs, ...(this.passage.pokedexMarkers ?? [])].some(p => p.page))) throw Error('Saved progress lacks passage context.');
      if (options.context !== undefined) {
        const context = validateContext(options.context, this.passage, this.state); this.temps = context.temps; this.page = context.page;
      }
    }
  }

  get state(): GameState {
    return this.currentState;
  }

  get checkpoint(): GameSnapshot {
    return this.currentCheckpoint;
  }

  /** Engine recovery only; replays pre-entry state without capturing over it. */
  restoreCheckpoint(): void {
    const snapshot = validateSnapshot(this.currentCheckpoint, this.story);
    this.currentState = this.enterPassage(snapshot.state);
  }

  /** Player recovery is available only after reading an authored death passage. */
  retryAfterDeath(): void {
    if (this.canAdvancePage) throw Error('Finish reading this passage first.');
    if (!this.passage.death) throw new Error('Try Again is only available on a death passage.');
    this.restoreCheckpoint();
  }

  get passage(): Passage {
    return this.findPassage(this.currentState.passageId);
  }

  get variables(): Variables { return Object.freeze({ ...this.state.variables, ...this.temps }); }
  get resumeContext(): ResumeContext | undefined {
    return this.passage.temps || [...this.passage.paragraphs, ...(this.passage.pokedexMarkers ?? [])].some(p => p.page) ? Object.freeze({ temps: this.temps, page: this.page }) : undefined;
  }
  get canAdvancePage(): boolean { return visiblePages(this.passage, this.state, this.temps).at(-1) !== this.page; }
  advancePage(): void {
    const pages = visiblePages(this.passage, this.state, this.temps); const next = pages[pages.indexOf(this.page) + 1];
    if (next === undefined) throw Error('No further narrative page.'); this.page = next;
  }
  get currentParagraphs(): readonly NarrativeParagraph[] { return this.visibleParagraphs.filter(p => (p.page ?? 0) === this.page); }
  get visibleChoices(): readonly Choice[] { return this.passage.choices.filter(c => !c.condition || evaluateCondition(c.condition, { ...this.state, variables: this.variables })); }
  isSelectable(choice: Choice): boolean { return !choice.selectable || evaluateCondition(choice.selectable, { ...this.state, variables: this.variables }); }
  get availableChoices(): readonly Choice[] {
    return Object.freeze(this.visibleChoices.filter(choice => this.isSelectable(choice)));
  }

  get visibleParagraphs(): readonly NarrativeParagraph[] {
    return Object.freeze(this.passage.paragraphs.filter(paragraph =>
      paragraph.condition === undefined || evaluateCondition(paragraph.condition, { ...this.currentState, variables: this.variables })));
  }

  /** Legacy destination navigation remains unambiguous for ordinary choices and Continue. */
  navigate(destinationId: string): void {
    if (this.canAdvancePage) throw Error('Finish reading this passage first.');
    if (this.passage.continueTo === destinationId) {
      this.transition({ ...this.currentState, passageId: destinationId });
      return;
    }
    const matches = this.availableChoices.filter(choice => choice.destinationId === destinationId);
    if (matches.length === 1) {
      this.navigateChoice(matches[0]!);
      return;
    }
    if (matches.length > 1) {
      // Historical destination-only calls remain valid when no choice has a side effect.
      if (matches.every(choice => choice.assignment === undefined)) {
        this.transition({ ...this.currentState, passageId: destinationId });
        return;
      }
      throw new Error('Multiple choices lead to "' + destinationId + '"; select a specific choice.');
    }
    throw new Error(`Passage "${this.passage.id}" has no action to "${destinationId}".`);
  }

  /** Apply the actual selected option before destination effects, as one atomic transition. */
  navigateChoice(choice: Choice): void {
    if (this.canAdvancePage) throw Error('Finish reading this passage first.');
    if (!this.passage.choices.includes(choice) || !this.availableChoices.includes(choice)) {
      throw new Error('That choice is not currently available.');
    }
    const variables = choice.assignment
      ? { ...this.currentState.variables, [choice.assignment.variable]: choice.assignment.value }
      : this.currentState.variables;
    this.transition({ ...this.currentState, passageId: choice.destinationId, variables });
  }

  /** The validated current passage alone selects the variable and destination. */
  submitText(value: unknown): void {
    if (this.canAdvancePage) throw Error('Finish reading this passage first.');
    const action = this.passage.textInput;
    if (action === undefined) throw new Error(`Passage "${this.passage.id}" does not offer text input.`);
    const text = validateTextInput(value);
    this.transition({
      ...this.currentState, passageId: action.destinationId,
      variables: { ...this.currentState.variables, [action.variable]: text },
    });
  }

  private transition(input: GameState): void {
    const checkpoint = this.findPassage(input.passageId).checkpoint
      ? validateSnapshot({ state: input }, this.story)
      : this.currentCheckpoint;
    const next = this.enterPassage(input);
    this.currentState = next;
    this.currentCheckpoint = checkpoint;
  }

  private enterPassage(input: GameState): GameState {
    const { passageId } = input;
    const passage = this.findPassage(passageId);
    // Checkpoints preserve this input boundary; effects run only on the copy below.
    const next = {
      passageId, variables: { ...input.variables }, journal: [...input.journal],
      party: [...input.party], skills: [...input.skills], inventory: { ...input.inventory },
    };
    const temporary = { ...passage.temps };
    const decisions = new Map<number, number>();
    const candidate = () => ({ ...next, variables: { ...next.variables, ...temporary } });
    for (const effect of passage.effects) {
      if (effect.guards?.some(guard => {
        if (!decisions.has(guard.id)) decisions.set(guard.id, guard.conditions.findIndex(condition => evaluateCondition(condition, candidate())));
        return decisions.get(guard.id) !== guard.branch;
      })) continue;
      const variableTarget = 'variable' in effect && Object.hasOwn(temporary, effect.variable) ? temporary : next.variables;
      if (effect.kind === 'set') {
        variableTarget[effect.variable] = effect.value;
      } else if (effect.kind === 'add') {
        const before = variableTarget[effect.variable];
        if (typeof before !== 'number') throw new Error(`Passage "${passageId}": *add requires a numeric variable.`);
        const value = before + effect.value;
        if (!Number.isFinite(value)) throw new Error(`Passage "${passageId}": *add on "${effect.variable}" produced a non-finite number.`);
        variableTarget[effect.variable] = value;
      } else if (effect.kind === 'journal') {
        if (!next.journal.some(entry => entry.id === effect.id)) {
          next.journal.push(Object.freeze({
            id: effect.id, chapter: passage.chapter, text: interpolate(effect.text, candidate().variables),
          }));
        }
      } else if (effect.kind === 'add_pokemon') {
        if (!next.party.some(member => member.id === effect.pokemonId)) {
          if (next.party.length >= 6) throw new Error(`Passage "${passageId}": Pokémon party is full (maximum six).`);
          const definition = this.story.pokemon.find(member => member.id === effect.pokemonId);
          if (!definition) throw new Error(`Unknown Pokémon "${effect.pokemonId}".`);
          const raw = effect.nicknameVariable ? next.variables[effect.nicknameVariable] : undefined;
          const nickname = raw === '' || raw === undefined ? undefined : validateTextInput(raw);
          next.party.push(Object.freeze({ ...definition, ...(nickname === undefined ? {} : { nickname }) }));
        }
      } else if (effect.kind === 'remove_pokemon') {
        const index = next.party.findIndex(member => member.id === effect.pokemonId);
        if (index !== -1) next.party.splice(index, 1);
      } else if (effect.kind === 'grant_skill') {
        if (!next.skills.includes(effect.skillId)) next.skills.push(effect.skillId);
      } else if (effect.kind === 'revoke_skill') {
        const index = next.skills.indexOf(effect.skillId);
        if (index !== -1) next.skills.splice(index, 1);
      } else if ('itemId' in effect) {
        const before = Object.hasOwn(next.inventory, effect.itemId) ? next.inventory[effect.itemId]! : 0;
        if (effect.kind === 'remove_item' && before < effect.quantity) {
          throw new Error(`Passage "${passageId}": insufficient inventory for "${effect.itemId}"; cannot remove ${effect.quantity} from ${before}.`);
        }
        const quantity = effect.kind === 'add_item' ? before + effect.quantity : before - effect.quantity;
        if (!Number.isSafeInteger(quantity) || quantity < 0) {
          throw new Error(`Passage "${passageId}": item quantity for "${effect.itemId}" must remain a nonnegative safe integer.`);
        }
        if (quantity === 0) delete next.inventory[effect.itemId];
        else next.inventory[effect.itemId] = quantity;
      }
    }
    this.temps = Object.freeze(temporary);
    this.page = visiblePages(passage, next, temporary)[0]!;
    Object.freeze(next.variables);
    Object.freeze(next.journal);
    Object.freeze(next.skills);
    Object.freeze(next.inventory);
    Object.freeze(next.party);
    return Object.freeze(next);
  }

  private findPassage(id: string): Passage {
    const passage = this.story.passages.find(passage => passage.id === id);
    if (!passage) throw new Error(`Missing passage "${id}".`);
    return passage;
  }
}
