import { describe, expect, it } from 'vitest';
import { shortcutStatus, urlsMatch, validateShortcutUrl } from '../src/domain/url';
import type { Shortcut, TabSnapshot } from '../src/types/models';

const shortcut: Shortcut = { id: 's', title: 'App', url: 'https://example.com/app', groupId: 'g', position: 0, icon: null, matchStrategy: 'EXACT', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const tab = (url: string, active = false): TabSnapshot => ({ id: 1, windowId: 1, index: 0, title: 'App', url, favIconUrl: null, active, pinned: false, currentWindow: true });

describe('URL matching', () => {
  it('matches exact URLs while ignoring fragments', () => expect(urlsMatch(shortcut.url, `${shortcut.url}#section`, 'EXACT')).toBe(true));
  it('supports origin and prefix policies without overmatching exact', () => {
    expect(urlsMatch(shortcut.url, 'https://example.com/other', 'ORIGIN')).toBe(true);
    expect(urlsMatch(shortcut.url, 'https://example.com/app/child', 'PREFIX')).toBe(true);
    expect(urlsMatch(shortcut.url, 'https://example.com/other', 'EXACT')).toBe(false);
  });
  it('reports active, open and closed shortcut states', () => {
    expect(shortcutStatus(shortcut, [tab(shortcut.url, true)])).toBe('ACTIVE');
    expect(shortcutStatus(shortcut, [tab(shortcut.url)])).toBe('OPEN');
    expect(shortcutStatus(shortcut, [])).toBe('CLOSED');
  });
  it('rejects executable, credentialed and malformed URLs', () => {
    expect(() => validateShortcutUrl('javascript:alert(1)')).toThrow();
    expect(() => validateShortcutUrl('https://user:pass@example.com')).toThrow();
    expect(() => validateShortcutUrl('not a url')).toThrow();
  });
});
