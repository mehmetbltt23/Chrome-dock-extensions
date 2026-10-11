import type { AppMessage, AppResponse, AppWindowSnapshot, DockPosition, DockTabsState, Preferences, Shortcut, TabSnapshot } from '../types/models';

(() => {
  const HOST_ID = 'docktabs-web-dock-host';
  const REPLACE_EVENT = 'docktabs:web-dock:replace';
  const STORAGE_KEY = 'docktabs.state';
  // The packaged new tab page is otherwise empty, so the Dock stays visible there.
  const alwaysVisible = document.documentElement.dataset.docktabsSurface === 'newtab';

  // An extension reload invalidates the previous content-script context but can
  // leave its DOM behind. Ask a current instance to clean up, then remove any
  // stale host left by an older version before mounting the replacement.
  document.dispatchEvent(new CustomEvent(REPLACE_EVENT));
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });
  let state: DockTabsState | null = null;
  let tabs: TabSnapshot[] = [];
  let appWindows: AppWindowSnapshot[] = [];
  let faviconData = new Map<string, string>();
  let controlsOpen = false;
  let draggedShortcutId: string | null = null;
  let pointerDrag: { pointerId: number; shortcutId: string; startX: number; startY: number; source: HTMLButtonElement } | null = null;
  let pointerDropTarget: HTMLElement | null = null;
  let dragHoldTimer: number | null = null;
  let autoHideTimer: number | null = null;
  let autoHideExpanded = false;
  let ignoreNextClick = false;
  let statusMessage = '';
  let focusAfterRenderId: string | null = null;
  let focusAfterRenderSelector: string | null = null;

  class WebDockError extends Error {
    public constructor(message: string) { super(message); this.name = 'WebDockError'; }
  }

  const send = async <T,>(message: AppMessage): Promise<T> => {
    const response = await chrome.runtime.sendMessage<AppMessage, AppResponse<T>>(message);
    if (!response.ok) throw new WebDockError(response.error);
    return response.value;
  };

  const isState = (value: unknown): value is DockTabsState => {
    if (typeof value !== 'object' || value === null) return false;
    if (!isRecord(value)) return false;
    const record = value;
    return record.schemaVersion === 1 && Array.isArray(record.groups) && Array.isArray(record.shortcuts) && typeof record.preferences === 'object' && record.preferences !== null;
  };

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  const initials = (title: string): string => title.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('');
  const matches = (shortcut: Shortcut, tab: TabSnapshot): boolean => {
    try {
      const expected = new URL(shortcut.url);
      const actual = new URL(tab.url);
      expected.hash = '';
      actual.hash = '';
      if (shortcut.matchStrategy === 'ORIGIN') return expected.origin === actual.origin;
      if (shortcut.matchStrategy === 'PREFIX') return actual.href.startsWith(expected.href);
      return expected.href === actual.href;
    } catch { return false; }
  };

  const makeControl = (label: string, glyph: string, action: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = glyph;
    button.addEventListener('click', action);
    return button;
  };

  const clearDragStyles = (): void => {
    for (const element of shadow.querySelectorAll('.dragging, .drop-target')) element.classList.remove('dragging', 'drop-target');
  };

  const findDropTarget = (clientX: number, clientY: number): HTMLElement | null => {
    for (const candidate of shadow.querySelectorAll<HTMLElement>('[data-shortcut-id], .separator, .trash-target')) {
      const bounds = candidate.getBoundingClientRect();
      if (clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom) return candidate;
    }
    return null;
  };

  const updateDropTarget = (clientX: number, clientY: number): void => {
    for (const element of shadow.querySelectorAll('.drop-target')) element.classList.remove('drop-target');
    const candidate = findDropTarget(clientX, clientY);
    if (candidate?.dataset.shortcutId === draggedShortcutId) {
      pointerDropTarget = null;
      return;
    }
    pointerDropTarget = candidate;
    pointerDropTarget?.classList.add('drop-target');
  };

  const finishDragging = (): void => {
    if (dragHoldTimer !== null) window.clearTimeout(dragHoldTimer);
    dragHoldTimer = null;
    clearDragStyles();
    draggedShortcutId = null;
    pointerDrag = null;
    pointerDropTarget = null;
    delete host.dataset.dragging;
    scheduleAutoHideDock();
  };

  const beginPointerDragging = (): void => {
    if (pointerDrag === null || draggedShortcutId !== null) return;
    expandAutoHideDock();
    draggedShortcutId = pointerDrag.shortcutId;
    host.dataset.dragging = 'true';
    ignoreNextClick = true;
    pointerDrag.source.classList.add('dragging');
  };

  const reorder = async (shortcutId: string, targetGroupId: string, beforeShortcutId: string | null, title: string): Promise<void> => {
    try {
      await send<undefined>({ type: 'shortcut/reorder', shortcutId, targetGroupId, beforeShortcutId });
      statusMessage = `${title} moved.`;
      render();
    } catch (reason) {
      statusMessage = reason instanceof Error ? reason.message : 'The shortcut could not be moved.';
      render();
    }
  };

  const setDockPosition = async (position: DockPosition): Promise<void> => {
    controlsOpen = false;
    focusAfterRenderSelector = '.menu-toggle';
    try {
      state = await send<DockTabsState>({ type: 'dock/position', position });
      statusMessage = `Dock moved to ${position.toLocaleLowerCase()}.`;
    } catch (reason) {
      statusMessage = reason instanceof Error ? reason.message : 'The Dock position could not be changed.';
    }
    render();
  };

  const removeDockShortcut = async (shortcut: Shortcut): Promise<void> => {
    try {
      state = await send<DockTabsState>({ type: 'shortcut/remove', shortcutId: shortcut.id });
      statusMessage = `${shortcut.title} removed from Dock.`;
    } catch (reason) {
      statusMessage = reason instanceof Error ? reason.message : 'The shortcut could not be removed.';
    }
    render();
  };

  const clearAutoHideTimer = (): void => {
    if (autoHideTimer !== null) window.clearTimeout(autoHideTimer);
    autoHideTimer = null;
  };

  const expandAutoHideDock = (): void => {
    clearAutoHideTimer();
    autoHideExpanded = true;
    host.dataset.autoHideExpanded = 'true';
  };

  const autoHideEnabled = (): boolean => !alwaysVisible && state?.preferences.dockAutoHide === true;

  const scheduleAutoHideDock = (): void => {
    clearAutoHideTimer();
    if (!autoHideEnabled() || controlsOpen || draggedShortcutId !== null) return;
    autoHideTimer = window.setTimeout(() => {
      autoHideTimer = null;
      const surfaceHovered = [...shadow.querySelectorAll<HTMLElement>('.dock, .actions-panel, .edge-trigger')].some((element) => element.matches(':hover'));
      const activeElement = shadow.activeElement;
      const hasKeyboardFocus = activeElement instanceof HTMLElement && activeElement.matches(':focus-visible');
      if (controlsOpen || draggedShortcutId !== null || hasKeyboardFocus || surfaceHovered) return;
      autoHideExpanded = false;
      host.dataset.autoHideExpanded = 'false';
    }, 650);
  };

  const bindAutoHideSurface = (element: HTMLElement): void => {
    element.addEventListener('pointerenter', expandAutoHideDock);
    element.addEventListener('pointerleave', scheduleAutoHideDock);
  };

  const render = (): void => {
    if (!state?.preferences.webDockEnabled) { host.remove(); return; }
    const currentState = state;
    const preferences = currentState.preferences;
    // Stored state is read raw here, so a mode missing from older data falls
    // back to the same default as storage validation.
    const storedPreferences: Partial<Preferences> = preferences;
    const openMode = storedPreferences.dockOpenMode ?? 'PINNED_TAB';
    const opensAppWindow = openMode === 'APP_WINDOW';
    const pinsDockTabs = openMode === 'PINNED_TAB';
    host.dataset.position = preferences.dockPosition.toLocaleLowerCase();
    host.dataset.autoHide = String(autoHideEnabled());
    host.dataset.autoHideExpanded = String(autoHideExpanded);
    host.dataset.controlsOpen = String(controlsOpen);
    host.style.setProperty('--dt-size', `${preferences.dockIconSize}px`);
    host.style.setProperty('--dt-scale', preferences.dockMagnification ? '1.18' : '1');

    const style = document.createElement('style');
    style.textContent = `
      :host { --dt-size: 32px; --dt-scale: 1.18; position: fixed; z-index: 2147483647; display: block; width: max-content; height: max-content; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; color-scheme: dark; }
      :host([data-position="left"]) { left: 8px; top: 50%; transform: translateY(-50%); }
      :host([data-position="right"]) { right: 8px; top: 50%; transform: translateY(-50%); }
      :host([data-position="top"]) { top: 8px; left: 50%; transform: translateX(-50%); }
      :host([data-position="bottom"]) { bottom: 8px; left: 50%; transform: translateX(-50%); }
      .dock { isolation: isolate; display: flex; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); gap: 5px; align-items: center; padding: 6px; overflow: auto; pointer-events: auto; border: 1px solid rgb(255 255 255 / 13%); border-radius: calc(var(--dt-size) * .5); background: rgb(27 23 35 / 92%); box-shadow: 0 10px 34px rgb(0 0 0 / 32%); backdrop-filter: blur(18px) saturate(1.15); transition: transform 160ms ease, opacity 160ms ease; scrollbar-width: none; }
      .dock::-webkit-scrollbar { display: none; }
      :host([data-position="left"]) .dock, :host([data-position="right"]) .dock { flex-direction: column; }
      :host([data-auto-hide="true"][data-auto-hide-expanded="false"][data-controls-open="false"][data-position="left"]:not([data-dragging="true"])) .dock { transform: translateX(calc(-100% + 8px)); opacity: .55; }
      :host([data-auto-hide="true"][data-auto-hide-expanded="false"][data-controls-open="false"][data-position="right"]:not([data-dragging="true"])) .dock { transform: translateX(calc(100% - 8px)); opacity: .55; }
      :host([data-auto-hide="true"][data-auto-hide-expanded="false"][data-controls-open="false"][data-position="top"]:not([data-dragging="true"])) .dock { transform: translateY(calc(-100% + 8px)); opacity: .55; }
      :host([data-auto-hide="true"][data-auto-hide-expanded="false"][data-controls-open="false"][data-position="bottom"]:not([data-dragging="true"])) .dock { transform: translateY(calc(100% - 8px)); opacity: .55; }
      :host([data-auto-hide="true"][data-auto-hide-expanded="false"][data-controls-open="false"]:not([data-dragging="true"])) .dock { pointer-events: none; }
      button { position: relative; display: grid; flex: 0 0 auto; width: var(--dt-size); height: var(--dt-size); padding: 0; place-items: center; border: 0; border-radius: calc(var(--dt-size) * .3); background: rgb(255 255 255 / 8%); color: #eeeaf5; cursor: pointer; transition: transform 140ms ease, background 140ms ease, box-shadow 140ms ease; }
      button:hover { z-index: 2; transform: scale(var(--dt-scale)); background: rgb(255 255 255 / 14%); }
      button:focus-visible { outline: 2px solid #a294ff; outline-offset: 2px; }
      .shortcut { cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
      .shortcut:active { cursor: grabbing; }
      .shortcut.dragging { opacity: .45; transform: scale(.92); }
      .shortcut.drop-target { outline: 2px dashed #b8aeff; outline-offset: 2px; }
      .shortcut.active { box-shadow: 0 0 0 2px #9485ff; }
      .shortcut.open::after { content: ''; position: absolute; width: 4px; height: 4px; right: 2px; bottom: 2px; border: 1px solid #1b1723; border-radius: 50%; background: #9c8cff; }
      .shortcut img { width: 62%; height: 62%; object-fit: contain; pointer-events: none; -webkit-user-drag: none; }
      .shortcut img + .initials { display: none; }
      .initials { font-size: calc(var(--dt-size) * .27); font-weight: 750; }
      .separator { flex: 0 0 auto; width: 1px; height: calc(var(--dt-size) * .66); margin: 2px; background: rgb(255 255 255 / 16%); }
      .separator.drop-target { background: #b8aeff; box-shadow: 0 0 0 2px rgb(184 174 255 / 25%); }
      :host([data-position="left"]) .separator, :host([data-position="right"]) .separator { width: calc(var(--dt-size) * .66); height: 1px; }
      .control { font-size: calc(var(--dt-size) * .48); font-weight: 450; }
      .menu-toggle { font-size: calc(var(--dt-size) * .48); letter-spacing: calc(var(--dt-size) * -.08); }
      .menu-toggle[aria-expanded="true"] { background: #514566; box-shadow: 0 0 0 1px #9485ff; }
      .actions-panel { position: absolute; z-index: 4; display: grid; grid-template-columns: repeat(4, var(--dt-size)); gap: 5px; padding: 6px; pointer-events: auto; border: 1px solid rgb(255 255 255 / 13%); border-radius: calc(var(--dt-size) * .42); background: rgb(27 23 35 / 96%); box-shadow: 0 10px 34px rgb(0 0 0 / 38%); backdrop-filter: blur(18px) saturate(1.15); }
      :host([data-position="left"]) .actions-panel { left: calc(100% + 7px); bottom: 6px; }
      :host([data-position="right"]) .actions-panel { right: calc(100% + 7px); bottom: 6px; }
      :host([data-position="top"]) .actions-panel { top: calc(100% + 7px); right: 6px; }
      :host([data-position="bottom"]) .actions-panel { right: 6px; bottom: calc(100% + 7px); }
      .actions-panel button { background: rgb(255 255 255 / 9%); }
      .position-control { font-size: calc(var(--dt-size) * .42); }
      .position-control.current { background: #514566; box-shadow: inset 0 0 0 2px #a294ff; }
      .trash-target { position: absolute; z-index: 5; display: grid; width: max(48px, calc(var(--dt-size) * 1.5)); height: max(48px, calc(var(--dt-size) * 1.5)); padding: 4px; place-content: center; place-items: center; border: 1px solid rgb(255 112 108 / 55%); border-radius: 50%; background: rgb(74 25 31 / 96%); box-shadow: 0 10px 34px rgb(0 0 0 / 38%); color: #fff; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 140ms ease, box-shadow 140ms ease, background 140ms ease; }
      :host([data-position="left"]) .trash-target { left: calc(100% + 12px); top: 50%; transform: translateY(-50%); }
      :host([data-position="right"]) .trash-target { right: calc(100% + 12px); top: 50%; transform: translateY(-50%); }
      :host([data-position="top"]) .trash-target { top: calc(100% + 12px); left: 50%; transform: translateX(-50%); }
      :host([data-position="bottom"]) .trash-target { bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%); }
      :host([data-dragging="true"]) .trash-target { opacity: 1; visibility: visible; }
      .trash-target.drop-target { border-color: #ff8b87; background: #9b3038; box-shadow: 0 0 0 4px rgb(255 95 87 / 28%), 0 10px 34px rgb(0 0 0 / 38%); }
      .trash-icon { font-size: max(21px, calc(var(--dt-size) * .6)); line-height: 1; }
      .trash-label { margin-top: 2px; font-size: max(9px, calc(var(--dt-size) * .22)); font-weight: 650; line-height: 1; }
      .edge-trigger { position: absolute; z-index: 3; pointer-events: none; background: transparent; }
      :host([data-auto-hide="true"]) .edge-trigger { pointer-events: auto; }
      :host([data-position="left"]) .edge-trigger { top: 0; bottom: 0; left: -8px; width: 10px; }
      :host([data-position="right"]) .edge-trigger { top: 0; right: -8px; bottom: 0; width: 10px; }
      :host([data-position="top"]) .edge-trigger { top: -8px; right: 0; left: 0; height: 10px; }
      :host([data-position="bottom"]) .edge-trigger { right: 0; bottom: -8px; left: 0; height: 10px; }
      .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } button:hover { transform: none; } }
    `;
    const dock = document.createElement('nav');
    dock.className = 'dock';
    dock.setAttribute('aria-label', 'DockTabs favorites');
    bindAutoHideSurface(dock);
    const groupOrder = new Map(currentState.groups.map((group) => [group.id, group.position]));
    const shortcuts = [...currentState.shortcuts].sort((a, b) => (groupOrder.get(a.groupId) ?? 0) - (groupOrder.get(b.groupId) ?? 0) || a.position - b.position);
    const handlePointerDrop = (movingId: string, targetElement: HTMLElement | null): void => {
      const moving = shortcuts.find((item) => item.id === movingId);
      if (moving === undefined || targetElement === null) return;
      if (targetElement.classList.contains('trash-target')) {
        void removeDockShortcut(moving);
        return;
      }
      const targetShortcutId = targetElement.dataset.shortcutId;
      if (targetShortcutId !== undefined) {
        const target = shortcuts.find((item) => item.id === targetShortcutId);
        if (target === undefined || target.id === moving.id) return;
        const movingIndex = shortcuts.findIndex((item) => item.id === moving.id);
        const targetIndex = shortcuts.findIndex((item) => item.id === target.id);
        const targetGroupShortcuts = shortcuts.filter((item) => item.groupId === target.groupId && item.id !== moving.id);
        const targetGroupIndex = targetGroupShortcuts.findIndex((item) => item.id === target.id);
        const insertIndex = targetGroupIndex + (movingIndex < targetIndex ? 1 : 0);
        const beforeShortcutId = targetGroupShortcuts[insertIndex]?.id ?? null;
        void reorder(moving.id, target.groupId, beforeShortcutId, moving.title);
        return;
      }
      if (!targetElement.classList.contains('separator')) return;
      const lastGroup = [...currentState.groups].sort((a, b) => a.position - b.position).at(-1);
      if (lastGroup !== undefined) void reorder(moving.id, lastGroup.id, null, moving.title);
    };
    for (const [shortcutIndex, shortcut] of shortcuts.entries()) {
      const wrapper = document.createElement('span');
      wrapper.style.position = 'relative';
      wrapper.style.display = 'grid';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shortcut';
      button.title = shortcut.title;
      button.setAttribute('aria-label', shortcut.title);
      button.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Alt+Backspace Alt+Delete');
      button.dataset.shortcutId = shortcut.id;
      const matching = tabs.filter((tab) => matches(shortcut, tab));
      if (opensAppWindow) {
        const appWindow = appWindows.find((candidate) => candidate.shortcutId === shortcut.id);
        if (appWindow?.focused === true) button.classList.add('active');
        else if (appWindow !== undefined) button.classList.add('open');
      } else if (matching.some((tab) => tab.active && tab.currentWindow)) button.classList.add('active');
      else if (matching.length > 0) button.classList.add('open');
      const fallback = document.createElement('span');
      fallback.className = 'initials';
      fallback.textContent = initials(shortcut.title);
      if (shortcut.icon !== 'INITIALS') {
        const resolvedIcon = shortcut.icon ?? faviconData.get(shortcut.url) ?? matching.find((tab) => tab.favIconUrl !== null)?.favIconUrl;
        if (resolvedIcon !== undefined && resolvedIcon !== null) {
          const image = document.createElement('img');
          image.alt = '';
          image.src = resolvedIcon;
          image.addEventListener('error', () => image.remove());
          button.append(image);
        }
      }
      button.append(fallback);
      button.addEventListener('click', () => {
        if (ignoreNextClick) { ignoreNextClick = false; return; }
        void send({ type: 'shortcut/open', shortcut, appWindow: opensAppWindow, pinTab: pinsDockTabs, reuseExistingTab: preferences.reuseExistingTab, searchOtherWindows: preferences.searchOtherWindows })
          .then(() => alwaysVisible ? send<undefined>({ type: 'launcher/close' }) : refreshTabs())
          .catch(() => undefined);
      });
      button.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        pointerDrag = { pointerId: event.pointerId, shortcutId: shortcut.id, startX: event.clientX, startY: event.clientY, source: button };
        button.setPointerCapture(event.pointerId);
        dragHoldTimer = window.setTimeout(beginPointerDragging, 320);
      });
      button.addEventListener('pointermove', (event) => {
        if (pointerDrag?.pointerId !== event.pointerId) return;
        if (draggedShortcutId === null) {
          if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 5) return;
          beginPointerDragging();
        }
        event.preventDefault();
        updateDropTarget(event.clientX, event.clientY);
      });
      button.addEventListener('pointerup', (event) => {
        if (pointerDrag?.pointerId !== event.pointerId) return;
        const movingId = draggedShortcutId;
        const targetElement = pointerDropTarget;
        if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
        finishDragging();
        if (movingId === null) return;
        event.preventDefault();
        handlePointerDrop(movingId, targetElement);
        window.setTimeout(() => { ignoreNextClick = false; }, 0);
      });
      button.addEventListener('pointercancel', (event) => {
        if (pointerDrag?.pointerId !== event.pointerId) return;
        finishDragging();
        ignoreNextClick = false;
      });
      button.addEventListener('keydown', (event) => {
        if (event.altKey && (event.key === 'Backspace' || event.key === 'Delete')) {
          event.preventDefault();
          void removeDockShortcut(shortcut);
          return;
        }
        if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
        if ((backwards && shortcutIndex === 0) || (!backwards && shortcutIndex === shortcuts.length - 1)) return;
        event.preventDefault();
        const target = shortcuts[shortcutIndex + (backwards ? -1 : 1)];
        if (target === undefined) return;
        const targetGroupShortcuts = shortcuts.filter((item) => item.groupId === target.groupId && item.id !== shortcut.id);
        const targetGroupIndex = targetGroupShortcuts.findIndex((item) => item.id === target.id);
        const beforeShortcutId = targetGroupShortcuts[targetGroupIndex + (backwards ? 0 : 1)]?.id ?? null;
        focusAfterRenderId = shortcut.id;
        void reorder(shortcut.id, target.groupId, beforeShortcutId, shortcut.title);
      });
      wrapper.append(button);
      dock.append(wrapper);
    }
    const separator = document.createElement('span');
    separator.className = 'separator';
    separator.setAttribute('aria-hidden', 'true');
    dock.append(separator);
    const menu = makeControl(controlsOpen ? 'Close DockTabs actions' : 'Open DockTabs actions', '•••', () => {
      controlsOpen = !controlsOpen;
      focusAfterRenderSelector = controlsOpen ? '.position-control.current' : '.menu-toggle';
      render();
    });
    menu.classList.add('menu-toggle');
    menu.setAttribute('aria-haspopup', 'true');
    menu.setAttribute('aria-expanded', String(controlsOpen));
    menu.setAttribute('aria-controls', 'docktabs-actions');
    dock.append(menu);
    const status = document.createElement('span');
    status.className = 'status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = statusMessage;
    dock.append(status);
    const rendered: Node[] = [style, dock];
    if (controlsOpen) {
      const actions = document.createElement('div');
      actions.id = 'docktabs-actions';
      actions.className = 'actions-panel';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'DockTabs actions');
      const positions: readonly [DockPosition, string, string][] = [
        ['LEFT', '←', 'Move Dock to left'],
        ['TOP', '↑', 'Move Dock to top'],
        ['BOTTOM', '↓', 'Move Dock to bottom'],
        ['RIGHT', '→', 'Move Dock to right'],
      ];
      for (const [position, glyph, label] of positions) {
        const positionButton = makeControl(label, glyph, () => { void setDockPosition(position); });
        positionButton.classList.add('position-control');
        positionButton.setAttribute('aria-pressed', String(preferences.dockPosition === position));
        if (preferences.dockPosition === position) positionButton.classList.add('current');
        actions.append(positionButton);
      }
      actions.append(makeControl('Add current page', '+', () => {
        controlsOpen = false;
        void send<Shortcut>({ type: 'shortcut/add-current' });
        render();
      }));
      actions.append(makeControl('Open DockTabs settings', '⚙', () => {
        controlsOpen = false;
        void send<undefined>({ type: 'options/open' });
        render();
      }));
      const close = makeControl('Close DockTabs actions', '×', () => {
        controlsOpen = false;
        focusAfterRenderSelector = '.menu-toggle';
        render();
      });
      actions.append(close);
      rendered.push(actions);
    }
    const trash = document.createElement('div');
    trash.className = 'trash-target';
    trash.setAttribute('aria-hidden', 'true');
    const trashIcon = document.createElement('span');
    trashIcon.className = 'trash-icon';
    trashIcon.textContent = '🗑';
    const trashLabel = document.createElement('span');
    trashLabel.className = 'trash-label';
    trashLabel.textContent = 'Remove';
    trash.append(trashIcon, trashLabel);
    rendered.push(trash);
    const edgeTrigger = document.createElement('div');
    edgeTrigger.className = 'edge-trigger';
    edgeTrigger.setAttribute('aria-hidden', 'true');
    edgeTrigger.addEventListener('pointerenter', expandAutoHideDock);
    edgeTrigger.addEventListener('pointerleave', scheduleAutoHideDock);
    rendered.push(edgeTrigger);
    shadow.replaceChildren(...rendered);
    if (focusAfterRenderId !== null) {
      const focusTarget = [...shadow.querySelectorAll<HTMLButtonElement>('[data-shortcut-id]')].find((candidate) => candidate.dataset.shortcutId === focusAfterRenderId);
      focusAfterRenderId = null;
      focusTarget?.focus();
    }
    if (focusAfterRenderSelector !== null) {
      const focusTarget = shadow.querySelector<HTMLButtonElement>(focusAfterRenderSelector);
      focusAfterRenderSelector = null;
      focusTarget?.focus();
    }
  };

  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (!controlsOpen) return;
    const target = event.target;
    if (target instanceof Node && host.contains(target)) return;
    controlsOpen = false;
    render();
  };
  const onHostKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !controlsOpen) return;
    event.preventDefault();
    controlsOpen = false;
    focusAfterRenderSelector = '.menu-toggle';
    render();
  };
  const onHostFocusIn = (): void => { expandAutoHideDock(); };
  const onHostFocusOut = (): void => { scheduleAutoHideDock(); };

  const refreshTabs = async (): Promise<void> => {
    try {
      [tabs, appWindows] = await Promise.all([send<TabSnapshot[]>({ type: 'tabs/get' }), send<AppWindowSnapshot[]>({ type: 'apps/get' })]);
      render();
    } catch { /* The dock stays usable without status decoration. */ }
  };
  // Indicators are refreshed when this page's window regains focus, which also
  // covers switching between Dock app windows.
  const onWindowFocus = (): void => { void refreshTabs(); };
  const onVisibilityChange = (): void => { if (document.visibilityState === 'visible') void refreshTabs(); };
  const refreshFavicons = async (): Promise<void> => {
    if (state === null) return;
    const urls = [...new Set(state.shortcuts.filter((shortcut) => shortcut.icon === null).map((shortcut) => shortcut.url))];
    try {
      const icons: Record<string, string | null> = {};
      for (let offset = 0; offset < urls.length; offset += 100) {
        Object.assign(icons, await send<Record<string, string | null>>({ type: 'favicons/get', urls: urls.slice(offset, offset + 100) }));
      }
      faviconData = new Map(Object.entries(icons).filter((entry): entry is [string, string] => entry[1] !== null));
      render();
    } catch { /* Initials remain visible when Chrome cannot provide a local favicon. */ }
  };
  const load = async (): Promise<void> => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    if (!isState(stored[STORAGE_KEY])) return;
    state = stored[STORAGE_KEY];
    render();
    scheduleAutoHideDock();
    await Promise.all([refreshTabs(), refreshFavicons()]);
  };
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== 'local' || !isState(changes[STORAGE_KEY]?.newValue)) return;
    state = changes[STORAGE_KEY].newValue;
    render();
    // Enabling auto-hide must collapse a Dock that was expanded while the
    // preference was off; the timer still keeps it open while hovered or focused.
    scheduleAutoHideDock();
    void refreshFavicons();
  };
  const onRuntimeMessage = (message: unknown): void => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
    if (message.type === 'tabs/changed') void refreshTabs();
    if (message.type === 'dock/remove') cleanup();
  };
  const cleanup = (): void => {
    document.removeEventListener(REPLACE_EVENT, cleanup);
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onWindowFocus);
    clearAutoHideTimer();
    try { chrome.storage.onChanged.removeListener(onStorageChanged); } catch { /* The previous extension context may already be invalid. */ }
    try { chrome.runtime.onMessage.removeListener(onRuntimeMessage); } catch { /* The previous extension context may already be invalid. */ }
    host.remove();
  };
  document.addEventListener(REPLACE_EVENT, cleanup, { once: true });
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onWindowFocus);
  host.addEventListener('keydown', onHostKeyDown);
  host.addEventListener('focusin', onHostFocusIn);
  host.addEventListener('focusout', onHostFocusOut);
  chrome.storage.onChanged.addListener(onStorageChanged);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  document.documentElement.append(host);
  void load().catch(cleanup);
})();
