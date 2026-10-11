import type { Shortcut } from '../types/models';
import { urlsMatch } from './url';

/** Shortcut ID → Chrome window ID. Browser-session only; never persisted to local storage. */
export type AppWindowRegistry = Readonly<Record<string, number>>;

export type AppWindowCandidate = { windowId: number; urls: readonly string[] };

const MAX_ENTRIES = 5000;

export function parseAppWindowRegistry(value: unknown): AppWindowRegistry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, number] => entry[0].length > 0 && entry[0].length <= 80 && Number.isInteger(entry[1]) && entry[1] >= 0);
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export function withAppWindow(registry: AppWindowRegistry, shortcutId: string, windowId: number): AppWindowRegistry {
  const rest = withoutWindow(registry, windowId);
  return { ...rest, [shortcutId]: windowId };
}

export function withoutWindow(registry: AppWindowRegistry, windowId: number): AppWindowRegistry {
  return Object.fromEntries(Object.entries(registry).filter((entry) => entry[1] !== windowId));
}

/**
 * Finds an unclaimed app window that already shows the shortcut, such as one
 * Chrome restored after a restart, so the Dock adopts it instead of duplicating it.
 */
export function findAdoptableWindow(shortcut: Shortcut, candidates: readonly AppWindowCandidate[], registry: AppWindowRegistry): number | undefined {
  const claimed = new Set(Object.values(registry));
  return candidates.find((candidate) => !claimed.has(candidate.windowId) && candidate.urls.some((url) => urlsMatch(shortcut.url, url, shortcut.matchStrategy)))?.windowId;
}
