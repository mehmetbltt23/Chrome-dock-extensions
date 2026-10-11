import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/domain/defaults';
import { moveShortcut, removeShortcut, removeGroup } from '../src/domain/state';

describe('state operations', () => {
  it('moves a shortcut within and across groups with normalized positions', () => {
    const initial = createDefaultState('2026-01-01T00:00:00.000Z');
    const moved = moveShortcut(initial, 'example-1', 'me', 1, '2026-01-02T00:00:00.000Z');
    expect(moved.shortcuts.find((item) => item.id === 'example-1')?.groupId).toBe('me');
    expect(moved.shortcuts.filter((item) => item.groupId === 'me').map((item) => item.position).sort()).toEqual([0, 1, 2]);
  });
  it('removes a shortcut without changing unrelated browser state', () => {
    const initial = createDefaultState();
    const next = removeShortcut(initial, 'example-1');
    expect(next.shortcuts).toHaveLength(initial.shortcuts.length - 1);
    expect(next.groups).toEqual(initial.groups);
  });
  it('moves a removed group’s shortcuts into a surviving group', () => {
    const next = removeGroup(createDefaultState(), 'me', 'quick');
    expect(next.groups.some((group) => group.id === 'me')).toBe(false);
    expect(next.shortcuts.some((item) => item.groupId === 'me')).toBe(false);
  });
});
