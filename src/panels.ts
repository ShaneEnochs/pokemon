import { pokemonInformation, pokemonThumbnail } from './pokedex-view';
import { discoveredPokemon, pokedexInstalled } from './pokedex';
import type { PokedexEntry } from './pokedex';
import type { Game } from './game';
import type { GameState, Story } from './types';

/** A fresh presentation of committed variables; no values are cached in UI state. */
export function characterStats(story: Story, state: GameState): { label: string; value: string }[] {
  return story.stats.map(({ variable, label }) => {
    const value = state.variables[variable];
    return { label, value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) };
  });
}

function panel(id: string, title: string, select: (title: string) => void, renderContent: (section: HTMLElement) => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = title;
  button.setAttribute('aria-controls', id);
  button.setAttribute('aria-pressed', 'false');
  const section = document.createElement('section');
  section.className = 'info-panel';
  section.id = id;
  section.hidden = true;
  section.setAttribute('aria-labelledby', id + '-heading');

  function render(): void {
    const heading = document.createElement('h2');
    heading.id = id + '-heading';
    heading.textContent = title;
    heading.tabIndex = -1;
    section.replaceChildren(heading);
    renderContent(section);
  }

  button.addEventListener('click', () => select(title));
  return { button, section, render };
}

function list(section: HTMLElement, entries: readonly string[], emptyText: string): void {
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = emptyText;
    section.append(empty);
    return;
  }
  const items = document.createElement('ul');
  for (const text of entries) {
    const item = document.createElement('li');
    item.textContent = text;
    items.append(item);
  }
  section.append(items);
}

/** Read-only information views; gameplay actions remain in the shared reader. */
export function createPanels(story: Story, game: Game, pokedex: readonly PokedexEntry[], select: (title: string) => void) {
  const inventory = panel('inventory', 'Inventory', select, section => {
    list(section, Object.entries(game.state.inventory).map(([id, quantity]) =>
      story.items.find(item => item.id === id)!.name + ' × ' + quantity), 'No items in inventory.');
  });

  const dex = panel('pokedex', 'Pokédex', select, section => {
    if (!pokedexInstalled(game.state)) {
      list(section, [], 'Pokédex access is not available yet.');
      return;
    }
    const discovered = discoveredPokemon(pokedex, game.state);
    const intro = document.createElement('p');
    intro.className = 'pokedex-intro';
    intro.textContent = "A field guide to the Pokémon you've encountered throughout Aurelia.";
    const count = document.createElement('p');
    count.className = 'pokedex-count';
    count.textContent = `${discovered.length} species discovered`;
    section.append(intro, count);
    if (discovered.length === 0) {
      list(section, [], 'No Pokémon recorded yet.');
      return;
    }
    const entries = document.createElement('ul');
    entries.className = 'pokedex-entries';
    for (const entry of discovered) {
      const item = document.createElement('li');
      const details = document.createElement('details');
      if (discovered.length === 1) details.open = true;
      const summary = document.createElement('summary');
      summary.className = 'pokedex-summary';
      const thumbnail = pokemonThumbnail(entry);
      if (thumbnail) summary.append(thumbnail);
      const identity = document.createElement('span');
      identity.className = 'pokedex-summary-identity';
      if (entry.nationalNumber !== undefined) {
        const number = document.createElement('span');
        number.className = 'pokedex-number';
        number.textContent = '#' + String(entry.nationalNumber).padStart(4, '0');
        identity.append(number);
      }
      const name = document.createElement('strong');
      name.className = 'pokedex-name';
      name.textContent = entry.name;
      identity.append(name);
      const labels = document.createElement('span');
      labels.className = 'pokedex-summary-labels';
      if (entry.types?.length) {
        const type = document.createElement('span');
        type.className = 'pokedex-type';
        type.textContent = entry.types.join(' / ');
        labels.append(type);
      }
      const status = document.createElement('span');
      status.className = 'pokedex-summary-status';
      status.textContent = entry.status;
      labels.append(status);
      identity.append(labels);
      summary.append(identity);
      details.append(summary, pokemonInformation(entry, 'pokedex'));
      item.append(details);
      entries.append(item);
    }
    section.append(entries);
  });

  const panels = [inventory, dex];
  return {
    buttons: panels.map(panel => panel.button),
    sections: panels.map(panel => panel.section),
    render(title: string): void { panels.find(panel => panel.button.textContent === title)!.render(); },
  };
}
