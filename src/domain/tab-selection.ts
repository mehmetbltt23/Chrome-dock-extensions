import type { Shortcut, TabSnapshot } from '../types/models';
import { urlsMatch } from './url';

export function selectReusableTab(shortcut: Shortcut, tabs: readonly TabSnapshot[], currentWindowId: number | undefined, searchOtherWindows: boolean): TabSnapshot | undefined {
  const currentMatches = tabs.filter((tab) => tab.windowId === currentWindowId && urlsMatch(shortcut.url, tab.url, shortcut.matchStrategy));
  const activeMatch = currentMatches.find((tab) => tab.active);
  if (activeMatch !== undefined) return activeMatch;
  if (currentMatches[0] !== undefined) return currentMatches[0];
  if (!searchOtherWindows) return undefined;
  return tabs.find((tab) => tab.windowId !== currentWindowId && urlsMatch(shortcut.url, tab.url, shortcut.matchStrategy));
}
