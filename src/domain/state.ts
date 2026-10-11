import type { DockTabsState, Shortcut, ShortcutGroup } from '../types/models';

function normalizePositions<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position).map((item, position) => ({ ...item, position }));
}

export function upsertShortcut(state: DockTabsState, shortcut: Shortcut, now = new Date().toISOString()): DockTabsState {
  const exists = state.shortcuts.some((item) => item.id === shortcut.id);
  const shortcuts = exists ? state.shortcuts.map((item) => (item.id === shortcut.id ? shortcut : item)) : [...state.shortcuts, shortcut];
  return { ...state, revision: state.revision + 1, shortcuts, updatedAt: now };
}

export function removeShortcut(state: DockTabsState, shortcutId: string, now = new Date().toISOString()): DockTabsState {
  const removed = state.shortcuts.find((item) => item.id === shortcutId);
  if (removed === undefined) return state;
  const shortcuts = state.shortcuts.filter((item) => item.id !== shortcutId);
  return { ...state, revision: state.revision + 1, shortcuts: normalizeGroupShortcuts(shortcuts), updatedAt: now };
}

function normalizeGroupShortcuts(shortcuts: readonly Shortcut[]): Shortcut[] {
  const groupIds = new Set(shortcuts.map((shortcut) => shortcut.groupId));
  const normalized = new Map<string, Shortcut>();
  for (const groupId of groupIds) {
    for (const shortcut of normalizePositions(shortcuts.filter((item) => item.groupId === groupId))) normalized.set(shortcut.id, shortcut);
  }
  return shortcuts.map((shortcut) => normalized.get(shortcut.id) ?? shortcut);
}

export function moveShortcut(state: DockTabsState, shortcutId: string, groupId: string, index: number, now = new Date().toISOString()): DockTabsState {
  const moved = state.shortcuts.find((item) => item.id === shortcutId);
  if (moved === undefined || !state.groups.some((group) => group.id === groupId)) return state;
  const without = state.shortcuts.filter((item) => item.id !== shortcutId);
  const target = without.filter((item) => item.groupId === groupId).sort((a, b) => a.position - b.position);
  target.splice(Math.max(0, Math.min(index, target.length)), 0, { ...moved, groupId, updatedAt: now });
  const positionedTarget = target.map((item, position) => ({ ...item, position }));
  const merged = without.filter((item) => item.groupId !== groupId).concat(positionedTarget);
  const shortcuts = normalizeGroupShortcuts(merged);
  return { ...state, revision: state.revision + 1, shortcuts, updatedAt: now };
}

export function upsertGroup(state: DockTabsState, group: ShortcutGroup, now = new Date().toISOString()): DockTabsState {
  const exists = state.groups.some((item) => item.id === group.id);
  const groups = normalizePositions(exists ? state.groups.map((item) => item.id === group.id ? group : item) : [...state.groups, group]);
  return { ...state, revision: state.revision + 1, groups, updatedAt: now };
}

export function removeGroup(state: DockTabsState, groupId: string, moveToGroupId: string, now = new Date().toISOString()): DockTabsState {
  if (groupId === moveToGroupId || !state.groups.some((item) => item.id === moveToGroupId)) return state;
  const groups = normalizePositions(state.groups.filter((item) => item.id !== groupId));
  const shortcuts = normalizeGroupShortcuts(state.shortcuts.map((item) => item.groupId === groupId ? { ...item, groupId: moveToGroupId, updatedAt: now } : item));
  return { ...state, revision: state.revision + 1, groups, shortcuts, updatedAt: now };
}
