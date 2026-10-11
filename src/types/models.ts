export type MatchStrategy = 'EXACT' | 'ORIGIN' | 'PREFIX';
export type LayoutMode = 'UNIFIED' | 'FAVORITES';
export type ThemeMode = 'AUTO' | 'LIGHT' | 'DARK' | 'CUSTOM';
export type Density = 'COMPACT' | 'COMFORTABLE' | 'EXPANDED';
export type DockPosition = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
export type DockOpenMode = 'PINNED_TAB' | 'APP_WINDOW' | 'TAB';

export type Shortcut = {
  id: string;
  title: string;
  url: string;
  groupId: string;
  position: number;
  icon: string | null;
  matchStrategy: MatchStrategy;
  createdAt: string;
  updatedAt: string;
};

export type ShortcutGroup = {
  id: string;
  title: string;
  position: number;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomTheme = {
  background: string;
  surface: string;
  text: string;
  accent: string;
  border: string;
  active: string;
};

export type Preferences = {
  layoutMode: LayoutMode;
  themeMode: ThemeMode;
  customTheme: CustomTheme;
  iconSize: number;
  gridColumns: 2 | 3 | 4;
  density: Density;
  reuseExistingTab: boolean;
  searchOtherWindows: boolean;
  showActiveIndicator: boolean;
  showOpenIndicator: boolean;
  showTooltips: boolean;
  webDockEnabled: boolean;
  dockPosition: DockPosition;
  dockIconSize: number;
  dockMagnification: boolean;
  dockAutoHide: boolean;
  dockOpenMode: DockOpenMode;
};

export type DockTabsState = {
  schemaVersion: 1;
  revision: number;
  groups: ShortcutGroup[];
  shortcuts: Shortcut[];
  preferences: Preferences;
  updatedAt: string;
};

export type TabSnapshot = {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  favIconUrl: string | null;
  active: boolean;
  pinned: boolean;
  currentWindow: boolean;
};

export type DockLaunchStatus = {
  shortcutId: string;
  status: 'ACTIVE' | 'OPEN';
};

export type ShortcutStatus = 'ACTIVE' | 'OPEN' | 'CLOSED';

export type DockTabsBackup = {
  format: 'docktabs-backup';
  version: 1;
  exportedAt: string;
  state: DockTabsState;
};

export type ImportCandidate = {
  sourceId: string;
  title: string;
  url: string;
  groupTitle: string;
  duplicate: boolean;
};

export type AppMessage =
  | { type: 'tabs/get' }
  | { type: 'dock/status' }
  | { type: 'favicons/get'; urls: string[] }
  | { type: 'shortcut/open'; shortcut: Shortcut; forceNew?: boolean; newWindow?: boolean; appWindow?: boolean; pinTab?: boolean; reuseExistingTab: boolean; searchOtherWindows: boolean }
  | { type: 'tab/activate'; tabId: number; windowId: number }
  | { type: 'tab/close'; tabId: number }
  | { type: 'tab/move'; tabId: number; index: number; windowId: number }
  | { type: 'tab/current' }
  | { type: 'tab/new' }
  | { type: 'shortcut/add-current' }
  | { type: 'shortcut/remove'; shortcutId: string }
  | { type: 'shortcut/reorder'; shortcutId: string; targetGroupId: string; beforeShortcutId: string | null }
  | { type: 'dock/position'; position: DockPosition }
  | { type: 'dock/sync'; enabled: boolean }
  | { type: 'options/open' }
  | { type: 'launcher/close' };

export type AppResponse<T> = { ok: true; value: T } | { ok: false; error: string };
