import { loadState, saveState } from '../storage/repository';
import type { AppMessage, AppResponse, AppWindowSnapshot, Shortcut, TabSnapshot } from '../types/models';
import { selectReusableTab } from '../domain/tab-selection';
import { DockTabsError } from '../domain/errors';
import { isAppMessage } from '../services/message-validation';
import { moveShortcut, removeShortcut, upsertShortcut } from '../domain/state';
import { validateShortcutUrl } from '../domain/url';
import { findAdoptableWindow, parseAppWindowRegistry, withAppWindow, withoutWindow, type AppWindowRegistry } from '../domain/app-windows';

const WEB_DOCK_SCRIPT_ID = 'docktabs-web-dock';
const WEB_DOCK_MATCHES = ['http://*/*', 'https://*/*'];
// Session storage survives worker suspension but is cleared when Chrome quits,
// matching the lifetime of the app windows it tracks.
const APP_WINDOWS_KEY = 'docktabs.appWindows';
const faviconCache = new Map<string, Promise<string | null>>();
let webDockSyncQueue: Promise<void> = Promise.resolve();
let stateMutationQueue: Promise<void> = Promise.resolve();
let appWindowQueue: Promise<void> = Promise.resolve();

function queueStateMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const task = stateMutationQueue.then(mutation);
  stateMutationQueue = task.then(() => undefined, () => undefined);
  return task;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function loadFavicon(pageUrl: string): Promise<string | null> {
  const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
  faviconUrl.searchParams.set('pageUrl', pageUrl);
  faviconUrl.searchParams.set('size', '64');
  try {
    const response = await fetch(faviconUrl);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length === 0 ? null : `data:image/png;base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

function getFavicon(pageUrl: string): Promise<string | null> {
  const cached = faviconCache.get(pageUrl);
  if (cached !== undefined) return cached;
  const pending = loadFavicon(pageUrl).then((icon) => {
    if (icon === null) faviconCache.delete(pageUrl);
    return icon;
  });
  faviconCache.set(pageUrl, pending);
  return pending;
}

async function sendDockRemoval(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [chrome.tabs.sendMessage(tab.id, { type: 'dock/remove' }).catch(() => undefined)]));
}

async function performWebDockSync(enabled: boolean, injectExisting: boolean): Promise<void> {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [WEB_DOCK_SCRIPT_ID] });
  if (!enabled) {
    await sendDockRemoval();
    if (registered.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [WEB_DOCK_SCRIPT_ID] });
    return;
  }
  if (registered.length === 0) {
    await chrome.scripting.registerContentScripts([{ id: WEB_DOCK_SCRIPT_ID, js: ['web-dock.js'], matches: WEB_DOCK_MATCHES, persistAcrossSessions: true, runAt: 'document_start' }]);
  } else {
    await chrome.scripting.updateContentScripts([{ id: WEB_DOCK_SCRIPT_ID, js: ['web-dock.js'], matches: WEB_DOCK_MATCHES, persistAcrossSessions: true, runAt: 'document_start' }]);
  }
  if (!injectExisting) return;
  const tabs = await chrome.tabs.query({ url: WEB_DOCK_MATCHES });
  await Promise.all(tabs.flatMap((tab) => tab.id === undefined ? [] : [chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['web-dock.js'] }).catch(() => undefined)]));
}

function syncWebDock(enabled: boolean, injectExisting = true): Promise<void> {
  const task = webDockSyncQueue.then(() => performWebDockSync(enabled, injectExisting));
  webDockSyncQueue = task.catch(() => undefined);
  return task;
}

async function restoreWebDockRegistration(): Promise<void> {
  const state = await loadState();
  const granted = await chrome.permissions.contains({ origins: WEB_DOCK_MATCHES });
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [WEB_DOCK_SCRIPT_ID] });
  const shouldRun = state.preferences.webDockEnabled && granted;
  if (shouldRun && registered.length === 0) await syncWebDock(true);
  if (!shouldRun && registered.length > 0) await syncWebDock(false);
}

function toSnapshot(tab: chrome.tabs.Tab): TabSnapshot | null {
  if (tab.id === undefined) return null;
  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    title: tab.title ?? 'Untitled tab',
    url: tab.url ?? tab.pendingUrl ?? '',
    favIconUrl: tab.favIconUrl ?? null,
    active: tab.active,
    pinned: tab.pinned,
    currentWindow: false,
  };
}

function requireSnapshot(tab: chrome.tabs.Tab): TabSnapshot {
  const snapshot = toSnapshot(tab);
  if (snapshot === null) throw new DockTabsError('CHROME_FAILED', 'Chrome did not return a usable tab.');
  return snapshot;
}

async function querySnapshots(query: chrome.tabs.QueryInfo = {}): Promise<TabSnapshot[]> {
  return (await chrome.tabs.query(query)).map(toSnapshot).filter((tab): tab is TabSnapshot => tab !== null);
}

async function focusTab(tab: TabSnapshot): Promise<TabSnapshot> {
  await chrome.windows.update(tab.windowId, { focused: true });
  const updated = await chrome.tabs.update(tab.id, { active: true });
  if (updated === undefined) throw new DockTabsError('CHROME_FAILED', 'Chrome could not activate the tab.');
  return requireSnapshot(updated);
}

function queueAppWindowMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const task = appWindowQueue.then(mutation);
  appWindowQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function loadAppWindows(): Promise<AppWindowRegistry> {
  const stored = await chrome.storage.session.get(APP_WINDOWS_KEY);
  return parseAppWindowRegistry(stored[APP_WINDOWS_KEY]);
}

async function saveAppWindows(registry: AppWindowRegistry): Promise<void> {
  await chrome.storage.session.set({ [APP_WINDOWS_KEY]: registry });
}

function forgetAppWindow(windowId: number): Promise<void> {
  return queueAppWindowMutation(async () => {
    const registry = await loadAppWindows();
    const next = withoutWindow(registry, windowId);
    if (Object.keys(next).length !== Object.keys(registry).length) await saveAppWindows(next);
  });
}

async function findWindow(windowId: number): Promise<chrome.windows.Window | undefined> {
  try { return await chrome.windows.get(windowId, { populate: true }); } catch { return undefined; }
}

async function focusAppWindow(appWindow: chrome.windows.Window): Promise<TabSnapshot> {
  if (appWindow.id === undefined) throw new DockTabsError('CHROME_FAILED', 'Chrome returned an app window without an ID.');
  await chrome.windows.update(appWindow.id, appWindow.state === 'minimized' ? { focused: true, state: 'normal' } : { focused: true });
  const tab = appWindow.tabs?.[0];
  if (tab === undefined) throw new DockTabsError('CHROME_FAILED', 'Chrome returned an app window without a tab.');
  return requireSnapshot(tab);
}

async function appWindowBounds(): Promise<Pick<chrome.windows.CreateData, 'left' | 'top' | 'width' | 'height'>> {
  try {
    const reference = await chrome.windows.getLastFocused();
    if (reference.state === 'minimized' || reference.state === 'fullscreen' || reference.state === 'locked-fullscreen') return {};
    const { left, top, width, height } = reference;
    if (left === undefined || top === undefined || width === undefined || height === undefined) return {};
    return { left, top, width, height };
  } catch {
    return {};
  }
}

// Dock shortcuts open like macOS apps: one tab-strip-free window per shortcut
// that the Dock brings forward again until the user closes it.
function openAppWindow(shortcut: Shortcut): Promise<TabSnapshot> {
  return queueAppWindowMutation(async () => {
    let registry = await loadAppWindows();
    const knownId = registry[shortcut.id];
    if (knownId !== undefined) {
      const known = await findWindow(knownId);
      if (known?.type === 'popup') return focusAppWindow(known);
      registry = withoutWindow(registry, knownId);
    }
    const popups = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
    const candidates = popups.flatMap((popup) => popup.id === undefined ? [] : [{ windowId: popup.id, urls: (popup.tabs ?? []).map((tab) => tab.url ?? tab.pendingUrl ?? '') }]);
    const adoptedId = findAdoptableWindow(shortcut, candidates, registry);
    const adopted = popups.find((popup) => popup.id !== undefined && popup.id === adoptedId);
    if (adopted?.id !== undefined) {
      await saveAppWindows(withAppWindow(registry, shortcut.id, adopted.id));
      return focusAppWindow(adopted);
    }
    const created = await chrome.windows.create({ url: shortcut.url, type: 'popup', focused: true, ...(await appWindowBounds()) });
    const tab = created?.tabs?.[0];
    if (created?.id === undefined || tab === undefined) throw new DockTabsError('CHROME_FAILED', 'Chrome could not open the app window.');
    await saveAppWindows(withAppWindow(registry, shortcut.id, created.id));
    return requireSnapshot(tab);
  });
}

async function getAppWindows(): Promise<AppWindowSnapshot[]> {
  const registry = await loadAppWindows();
  const focused = await chrome.windows.getLastFocused().catch(() => undefined);
  const focusedId = focused?.focused === true ? focused.id : undefined;
  return Object.entries(registry).map(([shortcutId, windowId]) => ({ shortcutId, windowId, focused: windowId === focusedId }));
}

async function openShortcut(
  shortcut: Shortcut,
  reuseExistingTab: boolean,
  searchOtherWindows: boolean,
  forceNew = false,
  newWindow = false,
  pinTab = false,
): Promise<TabSnapshot> {
  if (newWindow) {
    const created = await chrome.windows.create({ url: shortcut.url, focused: true });
    const tab = created?.tabs?.[0];
    if (tab === undefined) throw new DockTabsError('CHROME_FAILED', 'Chrome opened a window without a tab.');
    return requireSnapshot(tab);
  }
  // Tabs belong in a tab-strip window, even when the Dock was clicked inside an app window.
  const windowId = await lastNormalWindowId();
  if (!forceNew && reuseExistingTab) {
    // Only tab-strip windows are reused: a leftover app window would be brought
    // forward instead of opening the tab the user asked for, and cannot be pinned.
    const allTabs = await querySnapshots({ windowType: 'normal' });
    const preferred = selectReusableTab(shortcut, allTabs, windowId, searchOtherWindows);
    if (preferred !== undefined) {
      const focused = await focusTab(preferred);
      if (!pinTab || focused.pinned) return focused;
      const pinned = await chrome.tabs.update(focused.id, { pinned: true }).catch(() => undefined);
      return pinned === undefined ? focused : requireSnapshot(pinned);
    }
  }
  const created = await chrome.tabs.create({ url: shortcut.url, ...(windowId === undefined ? {} : { windowId }), active: true, pinned: pinTab });
  return requireSnapshot(created);
}

// Like Launchpad, the new tab page steps aside once it has launched a site. Only
// the packaged new tab page qualifies, and never as the last tab of its window.
async function closeLauncherTab(sender: chrome.runtime.MessageSender): Promise<void> {
  const tab = sender.tab;
  if (tab?.id === undefined || sender.url === undefined) return;
  if (new URL(sender.url).href.split(/[?#]/)[0] !== chrome.runtime.getURL('newtab.html')) return;
  const siblings = await chrome.tabs.query({ windowId: tab.windowId });
  if (siblings.length > 1) await chrome.tabs.remove(tab.id);
}

async function lastNormalWindowId(): Promise<number | undefined> {
  try { return (await chrome.windows.getLastFocused({ windowTypes: ['normal'] })).id; } catch { return undefined; }
}

async function handleMessage(message: AppMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'tabs/get':
      {
        const activeTabs = await querySnapshots({ active: true, lastFocusedWindow: true });
        const currentWindowId = activeTabs[0]?.windowId;
        return (await querySnapshots()).map((tab) => ({ ...tab, currentWindow: tab.windowId === currentWindowId }));
      }
    case 'apps/get':
      return getAppWindows();
    case 'favicons/get': {
      const icons = await Promise.all(message.urls.map(async (url) => [url, await getFavicon(url)] as const));
      const result = Object.fromEntries(icons) as Record<string, string | null>;
      return queueStateMutation(async () => {
        const state = await loadState();
        const shortcuts = state.shortcuts.map((shortcut) => {
          const icon = result[shortcut.url];
          if (shortcut.icon !== null || icon === null || icon === undefined) return shortcut;
          return { ...shortcut, icon, updatedAt: new Date().toISOString() };
        });
        const hasChanges = shortcuts.some((shortcut, index) => shortcut !== state.shortcuts[index]);
        if (hasChanges) await saveState({ ...state, revision: state.revision + 1, shortcuts, updatedAt: new Date().toISOString() });
        return result;
      });
    }
    case 'shortcut/open':
      if (message.appWindow === true) return openAppWindow(message.shortcut);
      return openShortcut(message.shortcut, message.reuseExistingTab, message.searchOtherWindows, message.forceNew, message.newWindow, message.pinTab);
    case 'tab/activate':
      return focusTab({ id: message.tabId, windowId: message.windowId, index: 0, title: '', url: '', favIconUrl: null, active: false, pinned: false, currentWindow: false });
    case 'tab/close':
      await chrome.tabs.remove(message.tabId);
      return undefined;
    case 'tab/move':
      {
        const moved = await chrome.tabs.move(message.tabId, { windowId: message.windowId, index: message.index });
        return requireSnapshot(Array.isArray(moved) ? moved[0] as chrome.tabs.Tab : moved);
      }
    case 'tab/current': {
      const tabs = await querySnapshots({ active: true, lastFocusedWindow: true });
      return tabs[0] ?? null;
    }
    case 'tab/new': {
      const activeTabs = await querySnapshots({ active: true, lastFocusedWindow: true });
      const windowId = activeTabs[0]?.windowId;
      return requireSnapshot(await chrome.tabs.create({ ...(windowId === undefined ? {} : { windowId }), active: true }));
    }
    case 'shortcut/add-current': {
      const snapshot = sender.tab === undefined ? (await querySnapshots({ active: true, lastFocusedWindow: true }))[0] : toSnapshot(sender.tab);
      if (snapshot === undefined || snapshot === null) throw new DockTabsError('CHROME_FAILED', 'Chrome did not provide the current tab.');
      const url = validateShortcutUrl(snapshot.url);
      return queueStateMutation(async () => {
        const state = await loadState();
        const existing = state.shortcuts.find((shortcut) => shortcut.url === url);
        if (existing !== undefined) return existing;
        const group = [...state.groups].sort((a, b) => a.position - b.position)[0];
        if (group === undefined) throw new DockTabsError('DATA_INVALID', 'Create a shortcut group first.');
        const now = new Date().toISOString();
        const shortcut: Shortcut = { id: crypto.randomUUID(), title: snapshot.title.slice(0, 120), url, groupId: group.id, position: state.shortcuts.filter((item) => item.groupId === group.id).length, icon: await getFavicon(url), matchStrategy: 'EXACT', createdAt: now, updatedAt: now };
        await saveState(upsertShortcut(state, shortcut, now));
        return shortcut;
      });
    }
    case 'shortcut/remove': {
      return queueStateMutation(async () => {
        const state = await loadState();
        const next = removeShortcut(state, message.shortcutId);
        await saveState(next);
        return next;
      });
    }
    case 'shortcut/reorder': {
      return queueStateMutation(async () => {
        const state = await loadState();
        const moving = state.shortcuts.find((shortcut) => shortcut.id === message.shortcutId);
        if (moving === undefined) throw new DockTabsError('DATA_INVALID', 'The shortcut to move no longer exists.');
        if (!state.groups.some((group) => group.id === message.targetGroupId)) throw new DockTabsError('DATA_INVALID', 'The target group no longer exists.');
        const target = message.beforeShortcutId === null ? undefined : state.shortcuts.find((shortcut) => shortcut.id === message.beforeShortcutId);
        if (message.beforeShortcutId !== null && target === undefined) throw new DockTabsError('DATA_INVALID', 'The target shortcut no longer exists.');
        if (target !== undefined && target.groupId !== message.targetGroupId) throw new DockTabsError('DATA_INVALID', 'The target shortcut is outside the target group.');
        const groupShortcuts = state.shortcuts.filter((shortcut) => shortcut.groupId === message.targetGroupId && shortcut.id !== moving.id).sort((a, b) => a.position - b.position);
        const targetIndex = target === undefined ? groupShortcuts.length : groupShortcuts.findIndex((shortcut) => shortcut.id === target.id);
        const next = moveShortcut(state, moving.id, message.targetGroupId, targetIndex);
        if (next !== state) await saveState(next);
        return undefined;
      });
    }
    case 'dock/sync':
      await syncWebDock(message.enabled);
      return undefined;
    case 'dock/position': {
      return queueStateMutation(async () => {
        const state = await loadState();
        if (state.preferences.dockPosition === message.position) return state;
        const now = new Date().toISOString();
        const next = {
          ...state,
          revision: state.revision + 1,
          preferences: { ...state.preferences, dockPosition: message.position },
          updatedAt: now,
        };
        await saveState(next);
        return next;
      });
    }
    case 'options/open':
      await chrome.runtime.openOptionsPage();
      return undefined;
    case 'launcher/close':
      await closeLauncherTab(sender);
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void (async () => {
    try {
      if (!isAppMessage(message)) throw new DockTabsError('DATA_INVALID', 'DockTabs rejected an invalid internal request.');
      const value = await handleMessage(message, sender);
      sendResponse({ ok: true, value } satisfies AppResponse<unknown>);
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'DockTabs could not complete the action.' } satisfies AppResponse<never>);
    }
  })();
  return true;
});

async function broadcastTabsChanged(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'tabs/changed' });
  } catch {
    // No extension page is currently listening.
  }
}

chrome.tabs.onCreated.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onRemoved.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onUpdated.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onActivated.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onMoved.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onAttached.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onDetached.addListener(() => { void broadcastTabsChanged(); });
chrome.tabs.onReplaced.addListener(() => { void broadcastTabsChanged(); });

chrome.windows.onFocusChanged.addListener(() => { void broadcastTabsChanged(); });
chrome.windows.onCreated.addListener(() => { void broadcastTabsChanged(); });
chrome.windows.onRemoved.addListener((windowId) => {
  void broadcastTabsChanged();
  void forgetAppWindow(windowId).catch(() => undefined);
});
chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage(); });

// Developer reloads clear dynamic content-script registrations without firing
// runtime.onInstalled. Restore only a missing registration so normal worker
// wake-ups do not replace an already active dock.
void restoreWebDockRegistration().catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const state = await loadState();
    const granted = await chrome.permissions.contains({ origins: WEB_DOCK_MATCHES });
    await syncWebDock(state.preferences.webDockEnabled && granted);
  })().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const state = await loadState();
    const granted = await chrome.permissions.contains({ origins: WEB_DOCK_MATCHES });
    await syncWebDock(state.preferences.webDockEnabled && granted, false);
  })().catch(() => undefined);
});
