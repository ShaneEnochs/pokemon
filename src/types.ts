export type VariableValue = number | boolean | string;
export type Variables = Readonly<Record<string, VariableValue>>;
export interface PokemonDefinition { readonly id: string; readonly species: string; }
export interface PartyMember extends PokemonDefinition { readonly nickname?: string; }
export type Party = readonly PartyMember[];
export type Inventory = Readonly<Record<string, number>>;
export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export type EffectGuard = { readonly id: number; readonly branch: number; readonly conditions: readonly Condition[] };

export type PassageEffect = (
  | { readonly kind: 'set'; readonly variable: string; readonly value: VariableValue }
  | { readonly kind: 'add'; readonly variable: string; readonly value: number }
  | { readonly kind: 'journal'; readonly id: string; readonly text: string }
  | { readonly kind: 'grant_skill' | 'revoke_skill'; readonly skillId: string }
  | { readonly kind: 'add_pokemon'; readonly pokemonId: string; readonly nicknameVariable?: string }
  | { readonly kind: 'remove_pokemon'; readonly pokemonId: string }
  | { readonly kind: 'add_item' | 'remove_item'; readonly itemId: string; readonly quantity: number }) & { readonly guards?: readonly EffectGuard[] };

export interface SkillDefinition {
  readonly id: string;
  readonly name: string;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
}

export interface StatDisplay {
  readonly variable: string;
  readonly label: string;
}

export interface JournalEntry {
  readonly id: string;
  readonly chapter: string;
  readonly text: string;
}

export type Condition =
  | { readonly operator: 'literal'; readonly value: boolean }
  | { readonly operator: 'and'; readonly left: Condition; readonly right: Condition }
  | { readonly operator: 'or'; readonly left: Condition; readonly right: Condition }
  | { readonly operator: 'not'; readonly operand: Condition }
  | { readonly variable: string; readonly operator: '==' | '!='; readonly value: VariableValue }
  | { readonly variable: string; readonly operator: '>' | '>=' | '<' | '<='; readonly value: number }
  | { readonly operator: 'has_pokemon' | 'lacks_pokemon'; readonly pokemonId: string }
  | { readonly operator: 'has_skill' | 'lacks_skill'; readonly skillId: string }
  | { readonly operator: 'has_item' | 'lacks_item'; readonly itemId: string }
  | { readonly operator: ComparisonOperator; readonly itemId: string; readonly value: number };

export interface Choice {
  readonly label: string;
  readonly destinationId: string;
  readonly condition?: Condition;
  readonly selectable?: Condition;
  /** Applied before destination entry, once the selected choice is committed. */
  readonly assignment?: { readonly variable: string; readonly value: VariableValue };
}

/** Read-only card anchored before a paragraph index, never part of saved state. */
export interface PokedexMarker {
  readonly speciesId: string;
  readonly beforeParagraph: number;
  readonly page?: number;
  readonly condition?: Condition;
  readonly line: number;
}

export interface NarrativeParagraph {
  readonly page?: number;
  readonly text: string;
  readonly condition?: Condition;
}

export interface TextInputAction {
  readonly variable: string;
  readonly label: string;
  readonly destinationId: string;
}

export interface Passage {
  readonly temps?: Variables;
  readonly id: string;
  readonly chapter: string;
  readonly title: string;
  /** Keep the title accessible to screen readers without displaying a large heading. */
  readonly hideTitle?: true;
  readonly checkpoint?: true;
  readonly death?: true;
  readonly effects: readonly PassageEffect[];
  readonly paragraphs: readonly NarrativeParagraph[];
  readonly pokedexMarkers?: readonly PokedexMarker[];
  readonly choices: readonly Choice[];
  readonly continueTo?: string;
  readonly textInput?: TextInputAction;
}

export interface Story {
  readonly startId: string;
  readonly pokemon: readonly PokemonDefinition[];
  readonly initialVariables: Variables;
  readonly skills: readonly SkillDefinition[];
  readonly items: readonly ItemDefinition[];
  readonly stats: readonly StatDisplay[];
  readonly passages: readonly Passage[];
}

/** The runtime's single source of gameplay state. */
export interface GameState {
  readonly passageId: string;
  readonly variables: Variables;
  readonly journal: readonly JournalEntry[];
  readonly skills: readonly string[];
  readonly inventory: Inventory;
  readonly party: Party;
}

/** The single in-memory checkpoint: complete state before destination entry effects. */
export interface GameSnapshot {
  readonly state: GameState;
}

export interface ResumeContext { readonly page: number; readonly temps: Variables; }
