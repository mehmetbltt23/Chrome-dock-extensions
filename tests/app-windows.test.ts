import { describe, expect, it } from 'vitest';
import { findAdoptableWindow, parseAppWindowRegistry, withAppWindow, withoutWindow } from '../src/domain/app-windows';
import { createDefaultState } from '../src/domain/defaults';
import { isAppMessage } from '../src/services/message-validation';
import { parseState } from '../src/storage/validation';
import type { Shortcut } from '../src/types/models';

const exampleShortcut = createDefaultState().shortcuts[0];
if (exampleShortcut === undefined) throw new Error('Default state must contain an example shortcut.');
const shortcut: Shortcut = { ...exampleShortcut, id: 'mail', url: 'https://mail.example.com/', matchStrategy: 'ORIGIN' };

describe('Dock app windows', () => {
  it('drops malformed session registry entries', () => {
    expect(parseAppWindowRegistry({ mail: 4, broken: 'x', negative: -1, fraction: 1.5, '': 3 })).toEqual({ mail: 4 });
    expect(parseAppWindowRegistry(null)).toEqual({});
    expect(parseAppWindowRegistry([1, 2])).toEqual({});
  });
  it('keeps one shortcut per window and forgets closed windows', () => {
    const registry = withAppWindow(withAppWindow({}, 'mail', 4), 'calendar', 4);
    expect(registry).toEqual({ calendar: 4 });
    expect(withoutWindow({ mail: 4, calendar: 5 }, 4)).toEqual({ calendar: 5 });
  });
  it('adopts an unclaimed restored window that already shows the shortcut', () => {
    const candidates = [{ windowId: 7, urls: ['https://other.example.com/'] }, { windowId: 8, urls: ['https://mail.example.com/inbox'] }];
    expect(findAdoptableWindow(shortcut, candidates, {})).toBe(8);
    expect(findAdoptableWindow(shortcut, candidates, { calendar: 8 })).toBeUndefined();
  });
  it('opens Dock sites as pinned tabs unless another valid mode is stored', () => {
    const legacyPreferences: Record<string, unknown> = { ...createDefaultState().preferences, openInAppWindow: true };
    delete legacyPreferences.dockOpenMode;
    const modeOf = (preferences: Record<string, unknown>): string => parseState({ ...createDefaultState(), preferences }).preferences.dockOpenMode;
    expect(modeOf(legacyPreferences)).toBe('PINNED_TAB');
    expect(modeOf({ ...legacyPreferences, dockOpenMode: 'APP_WINDOW' })).toBe('APP_WINDOW');
    expect(modeOf({ ...legacyPreferences, dockOpenMode: 'TAB' })).toBe('TAB');
    expect(modeOf({ ...legacyPreferences, dockOpenMode: 'POPUP' })).toBe('PINNED_TAB');
  });
  it('accepts app-window open requests and rejects malformed flags', () => {
    expect(isAppMessage({ type: 'apps/get' })).toBe(true);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, appWindow: true, reuseExistingTab: true, searchOtherWindows: true })).toBe(true);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, appWindow: 'yes', reuseExistingTab: true, searchOtherWindows: true })).toBe(false);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, pinTab: true, reuseExistingTab: true, searchOtherWindows: true })).toBe(true);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, pinTab: 1, reuseExistingTab: true, searchOtherWindows: true })).toBe(false);
  });
});
