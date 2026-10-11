import type { DockLaunchStatus, Shortcut, TabSnapshot } from '../types/models';
import { selectReusableTab } from './tab-selection';
import { urlsMatch } from './url';

/**
 * Shortcut ID → the Chrome tab or window the Dock opened for it. Browser-session
 * only (kept in chrome.storage.session), because Chrome reassigns these IDs.
 */
export type LaunchRegistry = Readonly<Record<string, number>>;

export type AdoptionCandidate = { id: number; urls: readonly string[] };

const MAX_ENTRIES = 5000;

export function parseLaunchRegistry(value: unknown): LaunchRegistry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, number] => entry[0].length > 0 && entry[0].length <= 80 && Number.isInteger(entry[1]) && entry[1] >= 0);
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export function withLaunch(registry: LaunchRegistry, shortcutId: string, targetId: number): LaunchRegistry {
  return { ...withoutTarget(registry, targetId), [shortcutId]: targetId };
}

export function withoutTarget(registry: LaunchRegistry, targetId: number): LaunchRegistry {
  return Object.fromEntries(Object.entries(registry).filter((entry) => entry[1] !== targetId));
}

export function withReplacedTarget(registry: LaunchRegistry, previousId: number, nextId: number): LaunchRegistry {
  return Object.fromEntries(Object.entries(registry).map(([shortcutId, targetId]) => [shortcutId, targetId === previousId ? nextId : targetId]));
}

function claimedByOthers(registry: LaunchRegistry, shortcutId: string): Set<number> {
  return new Set(Object.entries(registry).filter((entry) => entry[0] !== shortcutId).map((entry) => entry[1]));
}

/**
 * Finds an unclaimed app window that already shows the shortcut, such as one
 * Chrome restored after a restart, so the Dock adopts it instead of duplicating it.
 */
export function findAdoptableWindow(shortcut: Shortcut, candidates: readonly AdoptionCandidate[], registry: LaunchRegistry): number | undefined {
  const claimed = claimedByOthers(registry, shortcut.id);
  return candidates.find((candidate) => !claimed.has(candidate.id) && candidate.urls.some((url) => urlsMatch(shortcut.url, url, shortcut.matchStrategy)))?.id;
}

/**
 * Chooses the tab a Dock click should return to. The tab the Dock opened wins
 * even after the site navigated away from the shortcut URL; otherwise an
 * unclaimed URL match is reused, and in pinned mode a pinned tab on the same
 * site (as Chrome restores them after a restart) is adopted.
 */
export function pickDockTab(
  shortcut: Shortcut,
  tabs: readonly TabSnapshot[],
  registry: LaunchRegistry,
  currentWindowId: number | undefined,
  searchOtherWindows: boolean,
  pinned: boolean,
): TabSnapshot | undefined {
  const launched = tabs.find((tab) => tab.id === registry[shortcut.id]);
  if (launched !== undefined) return launched;
  const claimed = claimedByOthers(registry, shortcut.id);
  const unclaimed = tabs.filter((tab) => !claimed.has(tab.id));
  const match = selectReusableTab(shortcut, unclaimed, currentWindowId, searchOtherWindows);
  if (match !== undefined || !pinned) return match;
  return unclaimed.find((tab) => tab.pinned && urlsMatch(shortcut.url, tab.url, 'ORIGIN'));
}

/**
 * Dock indicators relative to the window showing the Dock: ACTIVE when the
 * launched tab is the selected tab there (or the window is the app window),
 * OPEN when it exists anywhere else.
 */
export function launchStatuses(
  tabRegistry: LaunchRegistry,
  windowRegistry: LaunchRegistry,
  tabs: readonly TabSnapshot[],
  viewerWindowId: number | undefined,
): DockLaunchStatus[] {
  const statuses = new Map<string, DockLaunchStatus['status']>();
  const record = (shortcutId: string, status: DockLaunchStatus['status']): void => {
    if (statuses.get(shortcutId) !== 'ACTIVE') statuses.set(shortcutId, status);
  };
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  for (const [shortcutId, tabId] of Object.entries(tabRegistry)) {
    const tab = tabsById.get(tabId);
    if (tab !== undefined) record(shortcutId, tab.active && tab.windowId === viewerWindowId ? 'ACTIVE' : 'OPEN');
  }
  const openWindows = new Set(tabs.map((tab) => tab.windowId));
  for (const [shortcutId, windowId] of Object.entries(windowRegistry)) {
    if (openWindows.has(windowId)) record(shortcutId, windowId === viewerWindowId ? 'ACTIVE' : 'OPEN');
  }
  return [...statuses].map(([shortcutId, status]) => ({ shortcutId, status }));
}
