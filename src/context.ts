import type { GameState, Passage, ResumeContext, Variables } from './types';
import { evaluateCondition } from './condition';
export function visiblePages(passage: Passage, state: GameState, temps: Variables): number[] {
  const merged = { ...state, variables: { ...state.variables, ...temps } };
  const pages = [...new Set([...passage.paragraphs, ...(passage.pokedexMarkers ?? [])].filter(p => !p.condition || evaluateCondition(p.condition, merged)).map(p => p.page ?? 0))];
  return pages.length ? pages.sort((a, b) => a - b) : [0];
}
export function validateContext(value: unknown, passage: Passage, state: GameState): ResumeContext {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'page,temps') throw Error('Invalid resume context fields.');
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== 2) throw Error('Resume context must be a plain data object.');
  const context = value as Record<string, unknown>;
  for (const field of ['page','temps']) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, field)!, 'value')) throw Error('Resume context must contain data.');
  if (!context.temps || typeof context.temps !== 'object' || Array.isArray(context.temps)) throw Error('Invalid temporary values.');
  const entries = context.temps as Record<string, unknown>; const declared = passage.temps ?? {};
  if (![Object.prototype, null].includes(Object.getPrototypeOf(entries)) || Reflect.ownKeys(entries).length !== Object.keys(declared).length) throw Error('Temporary values must be plain data.');
  if (Object.keys(entries).sort().join() !== Object.keys(declared).sort().join()) throw Error('Temporary declarations do not match.');
  const temps: Record<string, string | number | boolean> = {};
  for (const key of Object.keys(declared)) {
    const property = Object.getOwnPropertyDescriptor(entries, key)!;
    if (!Object.hasOwn(property, 'value')) throw Error('Temporary values must be data.');
    const item = property.value;
    if (typeof item !== typeof declared[key] || (typeof item === 'number' && !Number.isFinite(item))) throw Error('Invalid temporary type: ' + key);
    temps[key] = item;
  }
  if (!Number.isInteger(context.page) || !visiblePages(passage, state, temps).includes(context.page as number)) throw Error('Invalid saved page.');
  return Object.freeze({ page: context.page as number, temps: Object.freeze(temps) });
}
