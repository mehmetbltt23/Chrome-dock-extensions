import { isRecord } from '../storage/validation';
import type { AppMessage } from '../types/models';
import { validateShortcutUrl } from '../domain/url';

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { validateShortcutUrl(value); return true; } catch { return false; }
}

export function isAppMessage(value: unknown): value is AppMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'tabs/get':
    case 'dock/status':
    case 'tab/current':
    case 'tab/new':
    case 'shortcut/add-current':
    case 'options/open':
    case 'launcher/close':
      return true;
    case 'favicons/get':
      return Array.isArray(value.urls) && value.urls.length <= 100 && value.urls.every(isSafeUrl);
    case 'shortcut/remove':
      return typeof value.shortcutId === 'string' && value.shortcutId.length > 0 && value.shortcutId.length <= 80;
    case 'shortcut/reorder':
      return typeof value.shortcutId === 'string'
        && value.shortcutId.length > 0
        && value.shortcutId.length <= 80
        && typeof value.targetGroupId === 'string'
        && value.targetGroupId.length > 0
        && value.targetGroupId.length <= 80
        && (value.beforeShortcutId === null || (typeof value.beforeShortcutId === 'string' && value.beforeShortcutId.length > 0 && value.beforeShortcutId.length <= 80));
    case 'dock/sync':
      return typeof value.enabled === 'boolean';
    case 'dock/position':
      return value.position === 'LEFT' || value.position === 'RIGHT' || value.position === 'TOP' || value.position === 'BOTTOM';
    case 'tab/close':
      return isInteger(value.tabId);
    case 'tab/activate':
      return isInteger(value.tabId) && isInteger(value.windowId);
    case 'tab/move':
      return isInteger(value.tabId) && isInteger(value.windowId) && isInteger(value.index) && value.index >= 0;
    case 'shortcut/open': {
      const shortcut = value.shortcut;
      return isRecord(shortcut)
        && typeof shortcut.id === 'string'
        && typeof shortcut.title === 'string'
        && isSafeUrl(shortcut.url)
        && typeof shortcut.groupId === 'string'
        && isInteger(shortcut.position)
        && (shortcut.matchStrategy === 'EXACT' || shortcut.matchStrategy === 'ORIGIN' || shortcut.matchStrategy === 'PREFIX')
        && typeof value.reuseExistingTab === 'boolean'
        && typeof value.searchOtherWindows === 'boolean'
        && isOptionalBoolean(value.forceNew)
        && isOptionalBoolean(value.newWindow)
        && isOptionalBoolean(value.appWindow)
        && isOptionalBoolean(value.pinTab);
    }
    default:
      return false;
  }
}
