import type { MatchStrategy, Shortcut, TabSnapshot } from '../types/models';
import { DockTabsError } from './errors';

export function validateShortcutUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) throw new DockTabsError('URL_INVALID', 'Enter a URL up to 2048 characters.');
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { throw new DockTabsError('URL_INVALID', 'Enter a valid web URL.'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new DockTabsError('URL_INVALID', 'Only http:// and https:// URLs are allowed.');
  if (parsed.username !== '' || parsed.password !== '') throw new DockTabsError('URL_INVALID', 'URLs containing credentials are not allowed.');
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.href;
}

function comparableUrl(input: string): URL | null {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    parsed.hash = '';
    return parsed;
  } catch {
    return null;
  }
}

export function urlsMatch(shortcutUrl: string, tabUrl: string, strategy: MatchStrategy): boolean {
  const shortcut = comparableUrl(shortcutUrl);
  const tab = comparableUrl(tabUrl);
  if (shortcut === null || tab === null) return false;
  if (strategy === 'ORIGIN') return shortcut.origin === tab.origin;
  if (strategy === 'PREFIX') return tab.href.startsWith(shortcut.href);
  return shortcut.href === tab.href;
}

export function matchingTabs(shortcut: Shortcut, tabs: readonly TabSnapshot[]): TabSnapshot[] {
  return tabs.filter((tab) => urlsMatch(shortcut.url, tab.url, shortcut.matchStrategy));
}

export function shortcutStatus(shortcut: Shortcut, tabs: readonly TabSnapshot[]): 'ACTIVE' | 'OPEN' | 'CLOSED' {
  const matches = matchingTabs(shortcut, tabs);
  if (matches.some((tab) => tab.active)) return 'ACTIVE';
  return matches.length > 0 ? 'OPEN' : 'CLOSED';
}
