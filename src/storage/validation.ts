import { DEFAULT_PREFERENCES } from '../domain/defaults';
import { validateShortcutUrl } from '../domain/url';
import type { DockTabsState, MatchStrategy, Preferences, Shortcut, ShortcutGroup } from '../types/models';
import { DockTabsError } from '../domain/errors';

const MATCH_STRATEGIES = new Set<MatchStrategy>(['EXACT', 'ORIGIN', 'PREFIX']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function invalid(message: string): never {
  throw new DockTabsError('DATA_INVALID', message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string, max: number): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) return invalid(`Invalid ${key}.`);
  return value;
}

function dateField(record: Record<string, unknown>, key: string): string {
  const value = stringField(record, key, 64);
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) return invalid(`Invalid ${key}.`);
  return value;
}

function iconField(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 150_000) return invalid('Invalid shortcut icon.');
  if (value === 'INITIALS') return value;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(value)) return value;
  return validateShortcutUrl(value);
}

function parseGroup(value: unknown): ShortcutGroup {
  if (!isRecord(value)) return invalid('Invalid group.');
  const position = value.position;
  if (!Number.isInteger(position) || (position as number) < 0) return invalid('Invalid group position.');
  if (typeof value.collapsed !== 'boolean') return invalid('Invalid group collapsed state.');
  return {
    id: stringField(value, 'id', 80),
    title: stringField(value, 'title', 80),
    position: position as number,
    collapsed: value.collapsed,
    createdAt: dateField(value, 'createdAt'),
    updatedAt: dateField(value, 'updatedAt'),
  };
}

function parseShortcut(value: unknown): Shortcut {
  if (!isRecord(value)) return invalid('Invalid shortcut.');
  const position = value.position;
  if (!Number.isInteger(position) || (position as number) < 0) return invalid('Invalid shortcut position.');
  const strategy = value.matchStrategy;
  if (typeof strategy !== 'string' || !MATCH_STRATEGIES.has(strategy as MatchStrategy)) return invalid('Invalid match strategy.');
  return {
    id: stringField(value, 'id', 80),
    title: stringField(value, 'title', 120),
    url: validateShortcutUrl(stringField(value, 'url', 2048)),
    groupId: stringField(value, 'groupId', 80),
    position: position as number,
    icon: iconField(value.icon),
    matchStrategy: strategy as MatchStrategy,
    createdAt: dateField(value, 'createdAt'),
    updatedAt: dateField(value, 'updatedAt'),
  };
}

function parsePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES;
  const layoutMode = value.layoutMode === 'UNIFIED' ? 'UNIFIED' : 'FAVORITES';
  const themeMode = ['AUTO', 'LIGHT', 'DARK', 'CUSTOM'].includes(String(value.themeMode)) ? value.themeMode as Preferences['themeMode'] : 'AUTO';
  const density = ['COMPACT', 'COMFORTABLE', 'EXPANDED'].includes(String(value.density)) ? value.density as Preferences['density'] : 'COMFORTABLE';
  const gridColumns = [2, 3, 4].includes(Number(value.gridColumns)) ? Number(value.gridColumns) as 2 | 3 | 4 : 3;
  const iconSize = Number.isFinite(value.iconSize) ? Math.max(36, Math.min(72, Number(value.iconSize))) : 48;
  const dockIconSize = Number.isFinite(value.dockIconSize) ? Math.max(28, Math.min(56, Number(value.dockIconSize))) : 32;
  const dockOpenMode = ['PINNED_TAB', 'APP_WINDOW', 'TAB'].includes(String(value.dockOpenMode)) ? value.dockOpenMode as Preferences['dockOpenMode'] : 'PINNED_TAB';
  const dockPosition = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'].includes(String(value.dockPosition)) ? value.dockPosition as Preferences['dockPosition'] : 'LEFT';
  const custom = isRecord(value.customTheme) ? value.customTheme : {};
  const color = (key: keyof Preferences['customTheme']): string => typeof custom[key] === 'string' && /^#[0-9a-f]{6}$/i.test(custom[key]) ? custom[key] : DEFAULT_PREFERENCES.customTheme[key];
  return {
    layoutMode,
    themeMode,
    density,
    gridColumns,
    iconSize,
    customTheme: { background: color('background'), surface: color('surface'), text: color('text'), accent: color('accent'), border: color('border'), active: color('active') },
    reuseExistingTab: value.reuseExistingTab !== false,
    searchOtherWindows: value.searchOtherWindows !== false,
    showActiveIndicator: value.showActiveIndicator !== false,
    showOpenIndicator: value.showOpenIndicator !== false,
    showTooltips: value.showTooltips !== false,
    webDockEnabled: value.webDockEnabled === true,
    dockPosition,
    dockIconSize,
    dockMagnification: value.dockMagnification !== false,
    dockAutoHide: value.dockAutoHide === true,
    dockOpenMode,
  };
}

export function parseState(value: unknown): DockTabsState {
  if (!isRecord(value) || value.schemaVersion !== 1) return invalid('Unsupported DockTabs data version.');
  if (!Array.isArray(value.groups) || value.groups.length > 100) return invalid('Invalid groups.');
  if (!Array.isArray(value.shortcuts) || value.shortcuts.length > 5000) return invalid('Invalid shortcuts.');
  const groups = value.groups.map(parseGroup);
  const shortcuts = value.shortcuts.map(parseShortcut);
  const groupIds = new Set(groups.map((group) => group.id));
  if (groupIds.size !== groups.length) return invalid('Duplicate group IDs.');
  const shortcutIds = new Set(shortcuts.map((shortcut) => shortcut.id));
  if (shortcutIds.size !== shortcuts.length) return invalid('Duplicate shortcut IDs.');
  if (shortcuts.some((shortcut) => !groupIds.has(shortcut.groupId))) return invalid('A shortcut references a missing group.');
  const revision = value.revision;
  if (!Number.isInteger(revision) || (revision as number) < 0) return invalid('Invalid state revision.');
  return {
    schemaVersion: 1,
    revision: revision as number,
    groups,
    shortcuts,
    preferences: parsePreferences(value.preferences),
    updatedAt: dateField(value, 'updatedAt'),
  };
}

export function migrateState(value: unknown): DockTabsState {
  if (isRecord(value) && value.schemaVersion === 1) return parseState(value);
  if (isRecord(value) && value.schemaVersion === 0 && Array.isArray(value.groups) && Array.isArray(value.shortcuts)) {
    const now = new Date().toISOString();
    return parseState({ ...value, schemaVersion: 1, revision: 0, preferences: value.preferences ?? DEFAULT_PREFERENCES, updatedAt: value.updatedAt ?? now });
  }
  return invalid('This DockTabs data format is not supported.');
}
