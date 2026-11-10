import { lookupCard } from './pokedex-view';
import { validatePokedex, inlineLookups, passageLookups } from './pokedex';
import type { PokedexEntry } from './pokedex';
import { renderNarrative } from './format';
import type { TitlePage } from './title-page';
import type { Game } from './game';
import type { Story } from './types';
import { GameSession } from './session';
import type { CheckpointStorage, StorySaveIdentity } from './storage';
import { createPanels } from './panels';
import { interpolate } from './interpolate';
import { validatePeople } from './people';
import type { PersonReference } from './people';

interface ReaderEntry { readonly title: string; readonly titlePage?: TitlePage; readonly description?: string; readonly identity: StorySaveIdentity; readonly people: readonly PersonReference[]; readonly pokedex?: readonly PokedexEntry[]; }

export function showError(root: HTMLElement, error: unknown): void {
  root.querySelector('#story-error')?.remove();
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.id = 'story-error';
  message.textContent = `Story error: ${error instanceof Error ? error.message : String(error)}`;
  (root.querySelector('#story-content') ?? root).append(message);
}

export function appHeader(branding = 'Aurelian League'): HTMLElement {
  const header = document.createElement('header');
  header.className = 'app-header';
  const brand = document.createElement('p');
  brand.className = 'brand';
  brand.textContent = branding;
  header.append(brand);
  return header;
}

export function mountReader(root: HTMLElement, entry: ReaderEntry, story: Story, storage: CheckpointStorage, backToLibrary?: () => void): void {
  // Keep validating hidden People metadata for story and authoring integrity.
  validatePeople(story, entry.people);
  const pokedex = validatePokedex(story, entry.pokedex ?? []);
  const session = new GameSession(story, storage, entry.identity);
  let reportedNotice: unknown;
  let confirmation: HTMLDialogElement | undefined;

  function confirmAction(trigger: HTMLButtonElement, title: string, message: string, label: string, action: () => void): void {
    if (confirmation) return;
    const dialog = document.createElement('dialog');
    confirmation = dialog;
    dialog.className = 'confirmation';
    dialog.setAttribute('aria-labelledby', 'confirmation-title');
    dialog.setAttribute('aria-describedby', 'confirmation-message');
    const heading = document.createElement('h2');
    heading.id = 'confirmation-title'; heading.textContent = title;
    const description = document.createElement('p');
    description.id = 'confirmation-message'; description.textContent = message;
    const actions = document.createElement('div'); actions.className = 'confirmation-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.autofocus = true;
    const approve = document.createElement('button');
    approve.type = 'button'; approve.textContent = label; approve.className = 'primary-action';
    let accepted = false;
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === cancel) {
        event.preventDefault(); approve.focus();
      } else if (!event.shiftKey && document.activeElement === approve) {
        event.preventDefault(); cancel.focus();
      }
    });
    cancel.addEventListener('click', () => dialog.close());
    approve.addEventListener('click', () => {
      if (accepted) return;
      accepted = true; approve.disabled = true; dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove(); confirmation = undefined;
      if (accepted) action();
      if (trigger.isConnected) trigger.focus();
      else if (!root.contains(document.activeElement)) root.querySelector<HTMLElement>('h1')?.focus();
    }, { once: true });
    actions.append(cancel, approve); dialog.append(heading, description, actions);
    root.append(dialog); dialog.showModal();
  }

  function renderNotice(): void {
    root.querySelector('#save-status')?.remove();
    const notice = session.notice;
    if (notice === undefined && !session.canPlayWithoutSaving) return;
    const section = document.createElement('section');
    section.id = 'save-status';
    if (notice !== undefined) {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = notice.message;
      section.append(message);
      if (notice.error !== undefined && reportedNotice !== notice) {
        console.warn('Checkpoint persistence:', notice.error);
        reportedNotice = notice;
      }
    }
    if (session.canPlayWithoutSaving) {
      const play = document.createElement('button');
      play.type = 'button';
      play.textContent = 'Play without saving';
      play.addEventListener('click', () => confirmAction(play, 'Play without saving?',
        'Progress will be lost when this page closes. Existing saved progress will not be changed.', 'Play without saving', () => {
          const result = session.playWithoutSaving(() => true);
          if (result === 'started') showGameplay(session.game!);
          else if (result === 'failed') renderNotice();
        }));
      section.append(play);
    }
    root.insertBefore(section, root.querySelector('.reading-header')?.nextSibling ?? null);
  }

  function startNewGame(trigger: HTMLButtonElement, approved = false): void {
    if (confirmation) return;
    let needsConfirmation = false;
    const result = session.newGame(() => {
      needsConfirmation = true;
      return approved;
    });
    if (result === 'started') showGameplay(session.game!);
    else if (result === 'failed') renderNotice();
    else if (needsConfirmation) confirmAction(trigger, 'Start a new game?',
      'Starting over will replace your existing saved progress.', 'Start New Game', () => startNewGame(trigger, true));
  }

  function renderStartup(): void {
    root.className = 'startup title-screen';
    const heading = document.createElement('h1');
    heading.textContent = entry.title;
    heading.tabIndex = -1;
    root.replaceChildren(heading);
    if (entry.description) {
      const description = document.createElement('p');
      description.className = 'startup-description'; description.textContent = entry.description;
      root.append(description);
    }
    const startup = session.startup;
    if (startup.status === 'invalid' || startup.status === 'unavailable') {
      const message = document.createElement('p');
      message.className = 'startup-message';
      message.textContent = startup.status === 'invalid'
        ? 'A saved game was found, but it cannot be loaded.' : 'Saved progress could not be checked.';
      const reason = document.createElement('p');
      reason.textContent = startup.message;
      root.append(message, reason);
      console.warn('Saved game unavailable:', startup.error);
    }
    const actions = document.createElement('nav');
    actions.className = 'startup-actions';
    actions.setAttribute('aria-label', 'Game startup');
    if (startup.status === 'ready') {
      const resume = document.createElement('button');
      resume.type = 'button';
      resume.textContent = entry.titlePage?.continueGameLabel ?? 'Continue Game';
      resume.className = 'primary-action';
      resume.addEventListener('click', () => showGameplay(session.continueGame()));
      actions.append(resume);
    }
    const start = document.createElement('button');
    start.type = 'button';
    start.textContent = entry.titlePage?.newGameLabel ?? 'New Game';
    if (startup.status !== 'ready') start.className = 'primary-action';
    start.addEventListener('click', () => startNewGame(start));
    actions.append(start);
    if (backToLibrary !== undefined) {
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = 'Back to Stories';
      back.addEventListener('click', backToLibrary);
      actions.append(back);
    }
    root.append(actions);
    renderNotice();
    heading.focus();
  }

  function showGameplay(game: Game): void {
    const storyContent = document.createElement('section');
    storyContent.id = 'story-content';
    storyContent.setAttribute('aria-labelledby', 'passage-heading');
    const storyButton = document.createElement('button');
    storyButton.type = 'button';
    storyButton.textContent = 'Story';
    storyButton.setAttribute('aria-controls', 'story-content');
    storyButton.addEventListener('click', () => selectView('Story'));
    const panels = createPanels(story, game, pokedex, selectView);
    const navigation = document.createElement('nav');
    navigation.className = 'view-navigation';
    navigation.setAttribute('aria-label', 'Reading views');
    navigation.append(storyButton, ...panels.buttons);
    const chapter = document.createElement('p');
    chapter.className = 'chapter-label';
    const header = document.createElement('header');
    header.className = 'reading-header';
    header.append(navigation, chapter);
    // Wrapped chapter names and text scaling change the sticky obstruction.
    function syncHeaderSize(): void {
      document.documentElement.style.setProperty('--reading-header-space', `${header.getBoundingClientRect().height}px`);
    }
    const headerSize = new ResizeObserver(() => {
      if (!header.isConnected) { headerSize.disconnect(); return; }
      syncHeaderSize();
    });
    headerSize.observe(header);
    function selectView(name: string): void {
      chapter.hidden = name !== 'Story';
      syncHeaderSize();
      storyContent.hidden = name !== 'Story';
      storyButton.setAttribute('aria-pressed', String(name === 'Story'));
      for (let index = 0; index < panels.sections.length; index++) {
        const section = panels.sections[index]!;
        const active = panels.buttons[index]!.textContent === name;
        section.hidden = !active;
        panels.buttons[index]!.setAttribute('aria-pressed', String(active));
        if (active) {
          panels.render(name);
          section.querySelector<HTMLElement>('h2')!.focus();
        }
      }
      if (name === 'Story') storyContent.querySelector<HTMLElement>('h1')!.focus();
    }

    function render(): void {
      const passage = game.passage;
      root.className = passage.death ? 'reading death' : 'reading';
      const heading = document.createElement('h1');
      heading.id = 'passage-heading';
      heading.textContent = passage.title;
      if (passage.hideTitle) heading.classList.add('visually-hidden');
      heading.tabIndex = -1;

      const inline = inlineLookups(pokedex, game.state, passage, game.resumeContext?.page ?? 0, game.variables);
      const paragraphs: HTMLElement[] = [];
      for (let index = 0; index <= passage.paragraphs.length; index++) {
        for (const card of inline.filter(card => card.marker.beforeParagraph === index)) paragraphs.push(lookupCard(card.entry));
        const block = passage.paragraphs[index];
        if (!block || !game.currentParagraphs.includes(block)) continue;
        const { text } = block;
        const paragraph = document.createElement('p');
        paragraph.append(renderNarrative(text, game.variables));
        paragraphs.push(paragraph);
      }

      const actions = document.createElement('nav');
      actions.className = 'passage-actions';
      actions.setAttribute('aria-label', 'Passage actions');

      function addAction(label: string, action: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', () => {
          try {
            action();
            render();
          } catch (error) {
            showError(root, error);
          }
        });
        actions.append(button);
        return button;
      }

      if (game.canAdvancePage) { addAction('Continue', () => session.advancePage()); }
      else if (passage.death) {
        addAction('Try Again', () => session.retryAfterDeath());
      } else {
        const choices = game.visibleChoices;
        if (choices.length > 0) {
          const group = document.createElement('fieldset');
          group.className = 'choices';
          const legend = document.createElement('legend');
          legend.className = 'visually-hidden';
          legend.textContent = 'Choose an action';
          group.append(legend);
          let selected: typeof choices[number] | undefined;
          const continueButton = addAction('Continue', () => {
            if (selected !== undefined) session.navigateChoice(selected);
          });
          continueButton.disabled = true;
          for (const [index, choice] of choices.entries()) {
            const row = document.createElement('label');
            row.className = 'choice-row';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.disabled = !game.isSelectable(choice);
            radio.name = 'passage-choice';
            // Use the option index: distinct authored choices may share a destination.
            radio.value = String(index);
            radio.addEventListener('change', () => {
              selected = choice;
              continueButton.disabled = false;
            });
            const text = document.createElement('span');
            text.textContent = choice.label;
            row.append(radio, text);
            group.append(row);
          }
          actions.prepend(group);
        }
        const destination = passage.continueTo;
        if (destination !== undefined) addAction('Continue', () => session.navigate(destination));
      }

      if (!game.canAdvancePage && passage.textInput !== undefined) {
        const action = passage.textInput;
        const form = document.createElement('form');
        form.setAttribute('aria-label', 'Text input');
        form.noValidate = true;
        const label = document.createElement('label');
        label.htmlFor = 'player-text';
        label.textContent = action.label;
        const input = document.createElement('input');
        input.id = 'player-text';
        input.type = 'text';
        input.required = true;
        // Native maxLength counts UTF-16 units; Game validates Unicode code points.
        input.value = String(game.state.variables[action.variable]);
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'Continue';
        form.addEventListener('submit', event => {
          event.preventDefault();
          try {
            session.submitText(input.value);
            render();
          } catch (error) {
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', 'story-error');
            showError(root, error);
            input.focus();
          }
        });
        form.append(label, input, submit);
        actions.append(form);
      }

      chapter.textContent = passage.chapter;
      storyContent.replaceChildren(heading, ...paragraphs, ...passageLookups(pokedex, game.state, passage).filter(entry => !passage.pokedexMarkers?.some(marker => marker.speciesId === entry.id)).map(lookupCard), actions);
      root.replaceChildren(header, storyContent, ...panels.sections);
      selectView('Story');
      renderNotice();
      heading.focus();
    }

    render();
  }

  renderStartup();
}
