import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../src/domain/defaults';
import { loadState, saveState, STORAGE_KEY } from '../src/storage/repository';

describe('Chrome local persistence', () => {
  let memory: Record<string, unknown> = {};
  beforeEach(() => {
    memory = {};
    vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(() => Promise.resolve({ ...memory })), set: vi.fn((values: Record<string, unknown>) => { Object.assign(memory, values); return Promise.resolve(); }) }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } });
  });
  it('seeds first run and returns the same state after a simulated restart', async () => {
    const seeded = await loadState();
    expect(memory[STORAGE_KEY]).toEqual(seeded);
    expect(await loadState()).toEqual(seeded);
  });
  it('validates before saving and persists a valid update', async () => {
    const state = { ...createDefaultState(), revision: 7 };
    await saveState(state);
    expect((memory[STORAGE_KEY] as typeof state).revision).toBe(7);
  });
  it('preserves 21 shortcuts in 3 groups across a simulated Chrome restart', async () => {
    const base = createDefaultState('2026-01-01T00:00:00.000Z');
    const seed = base.shortcuts[0];
    if (seed === undefined) throw new Error('A default shortcut is required.');
    const state = { ...base, shortcuts: Array.from({ length: 21 }, (_, position) => ({ ...seed, id: `persist-${position}`, groupId: base.groups[position % 3]?.id ?? 'quick', position: Math.floor(position / 3) })) };
    await saveState(state);
    const restored = await loadState();
    expect(restored.groups).toHaveLength(3);
    expect(restored.shortcuts).toHaveLength(21);
  });
  it('persists compact dock placement and size preferences', async () => {
    const base = createDefaultState('2026-01-01T00:00:00.000Z');
    const state = { ...base, preferences: { ...base.preferences, webDockEnabled: true, dockPosition: 'BOTTOM' as const, dockIconSize: 30, dockMagnification: false, dockAutoHide: true } };
    await saveState(state);
    const restored = await loadState();
    expect(restored.preferences).toMatchObject({ webDockEnabled: true, dockPosition: 'BOTTOM', dockIconSize: 30, dockMagnification: false, dockAutoHide: true });
  });
});
