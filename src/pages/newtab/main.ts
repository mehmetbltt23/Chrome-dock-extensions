import './newtab.css';
import { dockOpenMessage } from '../../domain/dock-open';
import { resolveNewTabInput } from '../../domain/new-tab-input';
import { faviconUrl, sendMessage } from '../../services/chrome';
import { loadState, subscribeState } from '../../storage/repository';
import type { DockTabsState, Shortcut } from '../../types/models';

const form = document.querySelector<HTMLFormElement>('#search');
const input = document.querySelector<HTMLInputElement>('#query');
const launchpad = document.querySelector<HTMLElement>('#launchpad');
const status = document.querySelector<HTMLElement>('#status');

const announce = (message: string): void => { if (status !== null) status.textContent = message; };

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (input === null) return;
  const target = resolveNewTabInput(input.value);
  if (target.kind === 'empty') return;
  if (target.kind === 'url') {
    window.location.assign(target.url);
    return;
  }
  // chrome.search uses the default search engine chosen in Chrome settings.
  chrome.search.query({ text: target.text, disposition: 'CURRENT_TAB' }).catch(() => announce('Chrome could not run the search.'));
});

const initials = (title: string): string => title.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('');

function renderTile(shortcut: Shortcut, state: DockTabsState): HTMLButtonElement {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile';
  tile.title = shortcut.url;
  const icon = document.createElement('span');
  icon.className = 'tile-icon';
  icon.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('span');
  fallback.textContent = initials(shortcut.title);
  if (shortcut.icon !== 'INITIALS') {
    const image = document.createElement('img');
    image.alt = '';
    image.src = shortcut.icon ?? faviconUrl(shortcut.url);
    image.addEventListener('error', () => { image.remove(); fallback.hidden = false; });
    fallback.hidden = true;
    icon.append(image);
  }
  icon.append(fallback);
  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = shortcut.title;
  tile.append(icon, label);
  tile.addEventListener('click', () => {
    void sendMessage<unknown>(dockOpenMessage(shortcut, state.preferences))
      .then(() => sendMessage<undefined>({ type: 'launcher/close' }))
      .catch((reason: unknown) => announce(reason instanceof Error ? reason.message : `${shortcut.title} could not be opened.`));
  });
  return tile;
}

function renderLaunchpad(state: DockTabsState): void {
  if (launchpad === null) return;
  const sections = [...state.groups].sort((a, b) => a.position - b.position).flatMap((group) => {
    const shortcuts = state.shortcuts.filter((shortcut) => shortcut.groupId === group.id).sort((a, b) => a.position - b.position);
    if (shortcuts.length === 0) return [];
    const section = document.createElement('section');
    section.className = 'group';
    const heading = document.createElement('h2');
    heading.id = `group-${group.id}`;
    heading.textContent = group.title;
    section.setAttribute('aria-labelledby', heading.id);
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.append(...shortcuts.map((shortcut) => renderTile(shortcut, state)));
    section.append(heading, grid);
    return [section];
  });
  launchpad.replaceChildren(...sections);
}

void loadState().then(renderLaunchpad).catch(() => announce('Your favorites could not be loaded.'));
subscribeState(renderLaunchpad);

// Chrome blocks content scripts on the new tab page, so the override page loads
// the same self-contained Web Dock script that runs on websites.
const dock = document.createElement('script');
dock.src = chrome.runtime.getURL('web-dock.js');
document.head.append(dock);
