import { pokemonLabel } from './pokedex';
import type { DiscoveredPokemon } from './pokedex';

// Species IDs match authored metadata. Add future local asset URL entries here.
const artwork: Readonly<Record<string, string>> = Object.freeze({
  chikorita: new URL('../images/152-chikorita.png', import.meta.url).href,
});

function pokemonImage(entry: DiscoveredPokemon, thumbnail: boolean): HTMLImageElement | undefined {
  const source = Object.hasOwn(artwork, entry.id) ? artwork[entry.id] : undefined;
  if (!source) return undefined;
  const image = document.createElement('img');
  image.className = thumbnail ? 'pokemon-thumbnail' : 'pokemon-artwork';
  image.src = source;
  image.alt = thumbnail ? '' : entry.name + ' artwork';
  image.addEventListener('error', () => image.remove(), { once: true });
  return image;
}

export function pokemonThumbnail(entry: DiscoveredPokemon): HTMLImageElement | undefined {
  return pokemonImage(entry, true);
}

/** Safe DOM-only rendering for both Pokédex entries and narrative lookup cards. */
export function pokemonInformation(entry: DiscoveredPokemon, view: 'pokedex' | 'lookup' = 'lookup'): HTMLElement {
  const content = document.createElement('div');
  content.className = 'pokemon-information';
  const status = document.createElement('p');
  status.className = 'discovery-status';
  status.textContent = `${entry.status} · ${entry.chapter}`;
  if (view === 'lookup') content.append(status);
  const image = pokemonImage(entry, false);
  if (image) content.append(image);
  const values = document.createElement('dl');
  for (const [label, value] of [['Type', entry.types?.join(' / ')], ['Category', entry.category]]) {
    if (value === undefined) continue;
    const term = document.createElement('dt');
    term.textContent = label!;
    const description = document.createElement('dd');
    description.textContent = value;
    values.append(term, description);
  }
  if (values.childElementCount) content.append(values);
  if (view === 'pokedex') {
    const about = document.createElement('section');
    about.className = 'pokemon-about';
    const heading = document.createElement('h3');
    heading.textContent = 'About ' + entry.name;
    const description = document.createElement('p');
    description.textContent = entry.officialSummary ?? entry.description;
    about.append(heading, description);
    content.append(about);
    const encounter = document.createElement('section');
    encounter.className = 'pokemon-first-encounter';
    const encounterHeading = document.createElement('h3');
    encounterHeading.textContent = 'First encounter';
    encounter.append(encounterHeading);
    if (entry.firstEncounterLocation) {
      const location = document.createElement('p');
      location.className = 'pokemon-encounter-location';
      location.textContent = entry.firstEncounterLocation;
      encounter.append(location);
    }
    encounter.append(status);
    content.append(encounter);
  } else {
    const description = document.createElement('p');
    description.textContent = entry.officialSummary ?? entry.description;
    content.append(description);
    // Keep journal-backed observations for in-story lookup cards, not Pokédex Field Notes.
    if (entry.observations.length) {
      const heading = document.createElement('h4');
      heading.textContent = 'Your observations';
      const notes = document.createElement('ul');
      notes.className = 'pokemon-observations';
      for (const observation of entry.observations) {
        const item = document.createElement('li');
        item.textContent = observation.text;
        notes.append(item);
      }
      content.append(heading, notes);
    }
  }
  return content;
}

export function lookupCard(entry: DiscoveredPokemon): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'pokedex-card';
  card.setAttribute('aria-label', 'Pokédex lookup: ' + entry.name);
  const title = document.createElement('h3');
  title.textContent = 'Pokédex · ' + pokemonLabel(entry);
  card.append(title, pokemonInformation(entry));
  return card;
}
