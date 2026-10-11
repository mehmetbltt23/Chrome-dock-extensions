import type { AppMessage, Preferences, Shortcut } from '../types/models';

/** Builds the open request a Dock click sends, honoring the chosen open mode. */
export function dockOpenMessage(shortcut: Shortcut, preferences: Preferences): AppMessage {
  return {
    type: 'shortcut/open',
    shortcut,
    appWindow: preferences.dockOpenMode === 'APP_WINDOW',
    pinTab: preferences.dockOpenMode === 'PINNED_TAB',
    reuseExistingTab: preferences.reuseExistingTab,
    searchOtherWindows: preferences.searchOtherWindows,
  };
}
