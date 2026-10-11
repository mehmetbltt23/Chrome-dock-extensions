import { validateShortcutUrl } from '../../domain/url';
import { upsertGroup, upsertShortcut } from '../../domain/state';
import { DockTabsError } from '../../domain/errors';
import type { DockTabsState, ImportCandidate, Shortcut } from '../../types/models';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function directChildElements(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter((child) => child.tagName === tagName);
}

function findFollowingList(heading: Element): Element | null {
  const nested = heading.parentElement?.querySelector(':scope > dl');
  if (nested !== undefined && nested !== null) return nested;
  let sibling = heading.nextElementSibling;
  while (sibling !== null) {
    if (sibling.tagName === 'DL') return sibling;
    sibling = sibling.nextElementSibling;
  }
  sibling = heading.parentElement?.nextElementSibling ?? null;
  while (sibling !== null) {
    if (sibling.tagName === 'DL') return sibling;
    sibling = sibling.nextElementSibling;
  }
  return null;
}

export function parseVivaldiBookmarks(html: string, existing: readonly Shortcut[]): ImportCandidate[] {
  if (new Blob([html]).size > MAX_IMPORT_BYTES) throw new DockTabsError('IMPORT_INVALID', 'Bookmark files must be 5 MB or smaller.');
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const existingKeys = new Set(existing.map((shortcut) => `${shortcut.title.toLocaleLowerCase()}\u0000${shortcut.url}`));
  const candidates: ImportCandidate[] = [];
  const headings = Array.from(documentNode.querySelectorAll('h3'));
  for (const heading of headings) {
    const groupTitle = heading.textContent.trim();
    const list = findFollowingList(heading);
    if (groupTitle === '' || list === null) continue;
    for (const item of directChildElements(list, 'DT')) {
      const anchor = item.querySelector(':scope > a');
      if (anchor === null) continue;
      const rawUrl = anchor.getAttribute('href');
      const title = anchor.textContent.trim();
      if (rawUrl === null || title === '' || title.length > 120) continue;
      try {
        const url = validateShortcutUrl(rawUrl);
        candidates.push({ sourceId: `vivaldi-${candidates.length}`, title, url, groupTitle, duplicate: existingKeys.has(`${title.toLocaleLowerCase()}\u0000${url}`) });
      } catch {
        // Unsafe and malformed bookmark URLs are excluded from the preview.
      }
    }
  }
  if (candidates.length === 0) throw new DockTabsError('IMPORT_INVALID', 'No safe bookmarks were found in this file.');
  return candidates;
}

export function importVivaldiCandidates(
  state: DockTabsState,
  candidates: readonly ImportCandidate[],
  idFactory: () => string = () => crypto.randomUUID(),
  now = new Date().toISOString(),
): DockTabsState {
  let next = state;
  const groupsByTitle = new Map(next.groups.map((group) => [group.title.toLocaleLowerCase(), group.id]));
  for (const candidate of candidates) {
    if (candidate.duplicate) continue;
    const titleKey = candidate.groupTitle.toLocaleLowerCase();
    let groupId = groupsByTitle.get(titleKey);
    if (groupId === undefined) {
      groupId = idFactory();
      next = upsertGroup(next, { id: groupId, title: candidate.groupTitle, position: next.groups.length, collapsed: false, createdAt: now, updatedAt: now }, now);
      groupsByTitle.set(titleKey, groupId);
    }
    const position = next.shortcuts.filter((shortcut) => shortcut.groupId === groupId).length;
    next = upsertShortcut(next, { id: idFactory(), title: candidate.title, url: candidate.url, groupId, position, icon: null, matchStrategy: 'EXACT', createdAt: now, updatedAt: now }, now);
  }
  return next;
}
