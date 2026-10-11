import type { AppMessage, AppResponse, Shortcut, TabSnapshot } from '../types/models';
import { DockTabsError } from '../domain/errors';

export async function sendMessage<T>(message: AppMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage<AppMessage, AppResponse<T>>(message);
  if (!response.ok) throw new DockTabsError('CHROME_FAILED', response.error);
  return response.value;
}

export function getTabs(): Promise<TabSnapshot[]> {
  return sendMessage<TabSnapshot[]>({ type: 'tabs/get' });
}

export function openShortcut(shortcut: Shortcut, reuseExistingTab: boolean, searchOtherWindows: boolean, options?: { forceNew?: boolean; newWindow?: boolean }): Promise<TabSnapshot> {
  return sendMessage<TabSnapshot>({ type: 'shortcut/open', shortcut, reuseExistingTab, searchOtherWindows, ...options });
}

export function activateTab(tabId: number, windowId: number): Promise<TabSnapshot> {
  return sendMessage<TabSnapshot>({ type: 'tab/activate', tabId, windowId });
}

export async function closeTab(tabId: number): Promise<void> {
  await sendMessage<undefined>({ type: 'tab/close', tabId });
}

export function moveTab(tabId: number, windowId: number, index: number): Promise<TabSnapshot> {
  return sendMessage<TabSnapshot>({ type: 'tab/move', tabId, windowId, index });
}

export function currentTab(): Promise<TabSnapshot | null> {
  return sendMessage<TabSnapshot | null>({ type: 'tab/current' });
}

export function newTab(): Promise<TabSnapshot> {
  return sendMessage<TabSnapshot>({ type: 'tab/new' });
}

export function faviconUrl(pageUrl: string, size = 64): string {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.href;
}
