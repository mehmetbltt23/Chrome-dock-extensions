import { describe, expect, it } from 'vitest';
import { findAdoptableWindow, launchStatuses, parseLaunchRegistry, pickDockTab, withLaunch, withoutTarget, withReplacedTarget } from '../src/domain/launch-registry';
import { createDefaultState } from '../src/domain/defaults';
import { isAppMessage } from '../src/services/message-validation';
import { parseState } from '../src/storage/validation';
import type { Shortcut, TabSnapshot } from '../src/types/models';

const exampleShortcut = createDefaultState().shortcuts[0];
if (exampleShortcut === undefined) throw new Error('Default state must contain an example shortcut.');
const shortcut: Shortcut = { ...exampleShortcut, id: 'mail', url: 'https://mail.example.com/', matchStrategy: 'EXACT' };
const tab = (id: number, url: string, options: Partial<TabSnapshot> = {}): TabSnapshot => ({ id, windowId: 1, index: id, title: 'Tab', url, favIconUrl: null, active: false, pinned: false, currentWindow: true, ...options });

describe('Dock launch registry', () => {
  it('drops malformed session registry entries', () => {
    expect(parseLaunchRegistry({ mail: 4, broken: 'x', negative: -1, fraction: 1.5, '': 3 })).toEqual({ mail: 4 });
    expect(parseLaunchRegistry(null)).toEqual({});
    expect(parseLaunchRegistry([1, 2])).toEqual({});
  });
  it('keeps one shortcut per target and follows removed or replaced targets', () => {
    expect(withLaunch(withLaunch({}, 'mail', 4), 'calendar', 4)).toEqual({ calendar: 4 });
    expect(withoutTarget({ mail: 4, calendar: 5 }, 4)).toEqual({ calendar: 5 });
    expect(withReplacedTarget({ mail: 4, calendar: 5 }, 4, 9)).toEqual({ mail: 9, calendar: 5 });
  });
  it('adopts an unclaimed restored window that already shows the shortcut', () => {
    const candidates = [{ id: 7, urls: ['https://other.example.com/'] }, { id: 8, urls: ['https://mail.example.com/'] }];
    expect(findAdoptableWindow(shortcut, candidates, {})).toBe(8);
    expect(findAdoptableWindow(shortcut, candidates, { calendar: 8 })).toBeUndefined();
  });
});

describe('Dock tab selection', () => {
  it('returns to the launched tab after the site navigated away from the shortcut URL', () => {
    const redirected = tab(3, 'https://mail.example.com/u/0/#inbox');
    expect(pickDockTab(shortcut, [redirected], { mail: 3 }, 1, true, true)?.id).toBe(3);
  });
  it('reuses an unclaimed exact match but never a tab launched for another shortcut', () => {
    const exact = tab(4, 'https://mail.example.com/');
    expect(pickDockTab(shortcut, [exact], {}, 1, true, false)?.id).toBe(4);
    expect(pickDockTab(shortcut, [exact], { calendar: 4 }, 1, true, false)).toBeUndefined();
  });
  it('adopts a restored pinned tab on the same site only in pinned mode', () => {
    const restored = tab(5, 'https://mail.example.com/u/0/#inbox', { pinned: true });
    expect(pickDockTab(shortcut, [restored], {}, 1, true, true)?.id).toBe(5);
    expect(pickDockTab(shortcut, [restored], {}, 1, true, false)).toBeUndefined();
    expect(pickDockTab(shortcut, [tab(6, 'https://mail.example.com/x')], {}, 1, true, true)).toBeUndefined();
  });
});

describe('Dock indicators', () => {
  it('marks the launched tab active only when it is selected in the viewing window', () => {
    const tabs = [tab(3, 'https://mail.example.com/u/0', { active: true, windowId: 1 }), tab(4, 'https://calendar.example.com/', { windowId: 1 })];
    expect(launchStatuses({ mail: 3, calendar: 4 }, {}, tabs, 1)).toEqual([{ shortcutId: 'mail', status: 'ACTIVE' }, { shortcutId: 'calendar', status: 'OPEN' }]);
    expect(launchStatuses({ mail: 3 }, {}, tabs, 2)).toEqual([{ shortcutId: 'mail', status: 'OPEN' }]);
  });
  it('marks an app window active inside itself and drops closed targets', () => {
    const tabs = [tab(10, 'https://notes.example.com/', { windowId: 7 })];
    expect(launchStatuses({ mail: 99 }, { notes: 7 }, tabs, 7)).toEqual([{ shortcutId: 'notes', status: 'ACTIVE' }]);
    expect(launchStatuses({}, { notes: 7 }, tabs, 1)).toEqual([{ shortcutId: 'notes', status: 'OPEN' }]);
  });
});

describe('Dock open preferences and messages', () => {
  it('opens Dock sites as pinned tabs unless another valid mode is stored', () => {
    const legacyPreferences: Record<string, unknown> = { ...createDefaultState().preferences, openInAppWindow: true };
    delete legacyPreferences.dockOpenMode;
    const modeOf = (preferences: Record<string, unknown>): string => parseState({ ...createDefaultState(), preferences }).preferences.dockOpenMode;
    expect(modeOf(legacyPreferences)).toBe('PINNED_TAB');
    expect(modeOf({ ...legacyPreferences, dockOpenMode: 'APP_WINDOW' })).toBe('APP_WINDOW');
    expect(modeOf({ ...legacyPreferences, dockOpenMode: 'TAB' })).toBe('TAB');
    expect(modeOf({ ...legacyPreferences, dockOpenMode: 'POPUP' })).toBe('PINNED_TAB');
  });
  it('accepts Dock status and open requests and rejects malformed flags', () => {
    expect(isAppMessage({ type: 'dock/status' })).toBe(true);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, appWindow: true, reuseExistingTab: true, searchOtherWindows: true })).toBe(true);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, appWindow: 'yes', reuseExistingTab: true, searchOtherWindows: true })).toBe(false);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, pinTab: true, reuseExistingTab: true, searchOtherWindows: true })).toBe(true);
    expect(isAppMessage({ type: 'shortcut/open', shortcut, pinTab: 1, reuseExistingTab: true, searchOtherWindows: true })).toBe(false);
  });
});
