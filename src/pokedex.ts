import { evaluateCondition } from './condition';
import type { GameState, Story, Passage } from './types';

export interface PokemonObservation { readonly eventId: string; readonly text: string; }

/** Incremental species metadata; journal events are the sole discovery state. */
export interface PokedexEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly discoveryEvents: readonly string[];
  readonly acquisitionEvents: readonly string[];
  readonly nationalNumber?: number;
  readonly types?: readonly string[];
  readonly category?: string;
  readonly firstEncounterLocation?: string;
  readonly officialSummary?: string;
  readonly trainerNotes?: readonly string[];
  readonly observations: readonly PokemonObservation[];
}

export function parsePokedex(value: unknown): readonly PokedexEntry[] {
  if (!Array.isArray(value)) throw new Error('Pokédex metadata must be a JSON array.');
  const ids = new Set<string>();
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9_-]*$/.test(id);
  const events = (value: unknown): value is string[] => Array.isArray(value)
    && value.every(validId) && new Set(value).size === value.length;
  const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  return Object.freeze(value.map((raw: unknown, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Pokédex entry ${index + 1}: expected an object.`);
    const { id, name, description, discoveryEvents, acquisitionEvents = [] } = raw as Record<string, unknown>;
    if (!validId(id) || ids.has(id) || typeof name !== 'string' || !name.trim()
      || typeof description !== 'string' || !description.trim()
      || !events(discoveryEvents) || !events(acquisitionEvents)
      || discoveryEvents.length + acquisitionEvents.length === 0) {
      throw new Error(`Invalid or duplicate Pokédex entry: ${typeof id === 'string' ? id : index + 1}`);
    }
    const { nationalNumber, types, category, firstEncounterLocation, officialSummary, trainerNotes, observations = [] } = raw as Record<string, unknown>;
    if (nationalNumber !== undefined && (typeof nationalNumber !== 'number' || !Number.isSafeInteger(nationalNumber) || nationalNumber <= 0)) throw new Error(`Invalid National Pokédex number for "${id}".`);
    if (types !== undefined && (!Array.isArray(types) || types.length < 1 || types.length > 2 || ![...types].every(nonempty) || new Set(types).size !== types.length)) throw new Error(`Invalid Pokémon types for "${id}".`);
    if ((category !== undefined && !nonempty(category)) || (firstEncounterLocation !== undefined && !nonempty(firstEncounterLocation)) || (officialSummary !== undefined && !nonempty(officialSummary))) throw new Error(`Invalid species information for "${id}".`);
    if (trainerNotes !== undefined && (!Array.isArray(trainerNotes) || trainerNotes.length < 1
      || trainerNotes.length > 5 || !trainerNotes.every(nonempty)
      || new Set(trainerNotes).size !== trainerNotes.length)) {
      throw new Error(`Invalid trainer notes for "${id}".`);
    }
    if (!Array.isArray(observations)) throw new Error(`Invalid observations for "${id}".`);
    const observationIds = new Set<string>();
    const notes = [...observations].map((note: unknown) => {
      if (!note || typeof note !== 'object' || Array.isArray(note)) throw new Error(`Invalid observation for "${id}".`);
      const { eventId, text } = note as Record<string, unknown>;
      if (!validId(eventId) || observationIds.has(eventId) || !nonempty(text)) throw new Error(`Invalid or duplicate observation for "${id}".`);
      observationIds.add(eventId);
      return Object.freeze({ eventId, text });
    });
    ids.add(id);
    return Object.freeze({ id, name, description,
      ...(nationalNumber === undefined ? {} : { nationalNumber: nationalNumber as number }),
      ...(types === undefined ? {} : { types: Object.freeze([...(types as string[])]) }),
      ...(category === undefined ? {} : { category: category as string }),
      ...(firstEncounterLocation === undefined ? {} : { firstEncounterLocation: firstEncounterLocation as string }),
      ...(officialSummary === undefined ? {} : { officialSummary: officialSummary as string }),
      ...(trainerNotes === undefined ? {} : { trainerNotes: Object.freeze([...(trainerNotes as string[])]) }),
      observations: Object.freeze(notes),
      discoveryEvents: Object.freeze([...discoveryEvents]), acquisitionEvents: Object.freeze([...acquisitionEvents]),
    });
  }));
}

export function validatePokedex(story: Story, value: unknown): readonly PokedexEntry[] {
  const entries = parsePokedex(value);
  const events = new Set(story.passages.flatMap(passage => passage.effects
    .filter(effect => effect.kind === 'journal').map(effect => effect.id)));
  for (const entry of entries) {
    for (const event of [...entry.discoveryEvents, ...entry.acquisitionEvents, ...entry.observations.map(note => note.eventId)]) {
      if (!events.has(event)) throw new Error(`Pokédex entry "${entry.id}": unknown journal event "${event}".`);
    }
  }
  for (const passage of story.passages) {
    const scans = passage.effects.flatMap(effect => effect.kind === 'journal' && effect.id.startsWith('scanned_') ? [effect.id] : []);
    for (const marker of passage.pokedexMarkers ?? []) {
      const entry = entries.find(entry => entry.id === marker.speciesId);
      const fail = (message: string): never => { throw new Error(`Line ${marker.line}, passage "${passage.id}": *pokedex ${marker.speciesId}: ${message}`); };
      if (!entry) fail('unknown species in Pokédex metadata.');
      const related = (entry: PokedexEntry) => [...entry.discoveryEvents, ...entry.acquisitionEvents, ...entry.observations.map(note => note.eventId)];
      const matching = scans.filter(event => related(entry!).includes(event));
      if (!matching.length) fail('requires a matching scanned_ journal event in this passage.');
      if (entries.some(other => other.id !== entry!.id && matching.some(event => related(other).includes(event)))) fail('ambiguous scan event maps to multiple species.');
    }
  }
  return entries;
}

export function pokedexInstalled(state: GameState): boolean {
  return !Object.hasOwn(state.variables, 'dex_installed') || state.variables.dex_installed === true;
}

export function pokemonLabel(entry: PokedexEntry): string {
  return (entry.nationalNumber === undefined ? '' : '#' + String(entry.nationalNumber).padStart(4, '0') + ' ') + entry.name;
}

/** Never inspect prose, names, inventory, or a separate mutable discovery store. */
export function discoveredPokemon(entries: readonly PokedexEntry[], state: GameState) {
  if (!pokedexInstalled(state)) return [];
  return entries.flatMap(entry => {
    const first = state.journal.findIndex(event => entry.discoveryEvents.includes(event.id) || entry.acquisitionEvents.includes(event.id));
    if (first === -1) return [];
    const acquired = state.journal.some(event => entry.acquisitionEvents.includes(event.id));
    const observations = state.journal.flatMap(event => entry.observations.filter(note => note.eventId === event.id));
    return [{ ...entry, observations, status: acquired ? 'Acquired' : 'Encountered', chapter: state.journal[first]!.chapter, first }];
  }).sort((a, b) => a.first - b.first);
}

export type DiscoveredPokemon = ReturnType<typeof discoveredPokemon>[number];

/** A card needs a scan authored here AND its committed journal evidence.
 * Never re-evaluate effect guards against post-entry variables or execute effects. */
export function passageLookups(entries: readonly PokedexEntry[], state: GameState, passage: Passage): DiscoveredPokemon[] {
  const scans = new Set(passage.effects.flatMap(effect => effect.kind === 'journal' && effect.id.startsWith('scanned_')
    && state.journal.some(event => event.id === effect.id) ? [effect.id] : []));
  return discoveredPokemon(entries, state).flatMap(entry => {
    const related = [...entry.discoveryEvents, ...entry.acquisitionEvents, ...entry.observations.map(note => note.eventId)];
    if (!related.some(event => scans.has(event))) return [];
    return [{ ...entry, observations: entry.observations.filter(note => scans.has(note.eventId)) }];
  });
}

/** Merge eligible cards into the current narrative page; marker species reserve their legacy slot. */
export function inlineLookups(entries: readonly PokedexEntry[], state: GameState, passage: Passage, page: number, variables: GameState['variables']) {
  const eligible = passageLookups(entries, state, passage);
  return (passage.pokedexMarkers ?? []).flatMap(marker => {
    if ((marker.page ?? 0) !== page || (marker.condition && !evaluateCondition(marker.condition, { ...state, variables }))) return [];
    const entry = eligible.find(entry => entry.id === marker.speciesId);
    return entry ? [{ marker, entry }] : [];
  });
}
