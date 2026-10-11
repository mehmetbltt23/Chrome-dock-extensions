import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/domain/defaults';
import { selectReusableTab } from '../src/domain/tab-selection';
import { resolveTheme } from '../src/features/theme/useTheme';
import { parseState } from '../src/storage/validation';
import { isAppMessage } from '../src/services/message-validation';
import type { Shortcut, TabSnapshot } from '../src/types/models';

const exampleShortcut = createDefaultState().shortcuts[0];
if (exampleShortcut === undefined) throw new Error('Default state must contain an example shortcut.');
const shortcut: Shortcut = { ...exampleShortcut, url: 'https://example.com/', matchStrategy: 'ORIGIN' };
const tab = (id: number, windowId: number, active: boolean): TabSnapshot => ({ id, windowId, index: id, title: 'Example', url: 'https://example.com/page', favIconUrl: null, active, pinned: false, currentWindow: windowId === 1 });

describe('runtime policies', () => {
  it('creates on first click and reuses the match on the second click', () => {
    expect(selectReusableTab(shortcut, [], 1, true)).toBeUndefined();
    expect(selectReusableTab(shortcut, [tab(1, 1, true)], 1, true)?.id).toBe(1);
  });
  it('prefers an active duplicate in the current window', () => expect(selectReusableTab(shortcut, [tab(1, 1, false), tab(2, 1, true), tab(3, 2, true)], 1, true)?.id).toBe(2));
  it('uses another window only when enabled', () => {
    expect(selectReusableTab(shortcut, [tab(3, 2, true)], 1, false)).toBeUndefined();
    expect(selectReusableTab(shortcut, [tab(3, 2, true)], 1, true)?.id).toBe(3);
  });
  it('resolves automatic theme changes and preserves explicit themes', () => {
    expect(resolveTheme('AUTO', true)).toBe('DARK');
    expect(resolveTheme('AUTO', false)).toBe('LIGHT');
    expect(resolveTheme('CUSTOM', true)).toBe('CUSTOM');
  });
  it('survives serialization as a Chrome restart and panel reopen would', () => {
    const state = createDefaultState('2026-01-01T00:00:00.000Z');
    const restored = parseState(JSON.parse(JSON.stringify(state)) as unknown);
    expect(restored).toEqual(state);
  });
  it('handles 100 groups with 100 shortcuts without corrupting data', () => {
    const base = createDefaultState('2026-01-01T00:00:00.000Z');
    const exampleGroup = base.groups[0];
    const example = base.shortcuts[0];
    if (exampleGroup === undefined || example === undefined) throw new Error('Default examples are required.');
    const groups = Array.from({ length: 100 }, (_, position) => ({ ...exampleGroup, id: `g-${position}`, position }));
    const shortcuts = Array.from({ length: 100 }, (_, position) => ({ ...example, id: `s-${position}`, groupId: `g-${position}`, position: 0 }));
    expect(parseState({ ...base, groups, shortcuts }).shortcuts).toHaveLength(100);
  });
  it('selects the matching tab from a 100-tab window', () => {
    const tabs = Array.from({ length: 100 }, (_, index): TabSnapshot => ({ ...tab(index + 1, 1, false), url: index === 99 ? 'https://example.com/target' : `https://unrelated-${index}.example/` }));
    expect(selectReusableTab(shortcut, tabs, 1, true)?.id).toBe(100);
  });
  it('rejects malformed extension messages at the service-worker boundary', () => {
    expect(isAppMessage({ type: 'tab/close', tabId: 'not-a-number' })).toBe(false);
    expect(isAppMessage({ type: 'unknown', shortcut: { url: 'javascript:alert(1)' } })).toBe(false);
    expect(isAppMessage({ type: 'tab/close', tabId: 42 })).toBe(true);
    expect(isAppMessage({ type: 'dock/sync', enabled: true })).toBe(true);
    expect(isAppMessage({ type: 'dock/sync', enabled: 'yes' })).toBe(false);
  });
});
