import type { DockTabsState, Preferences, Shortcut, ShortcutGroup } from '../types/models';

export const DEFAULT_PREFERENCES: Preferences = {
  layoutMode: 'FAVORITES',
  themeMode: 'AUTO',
  customTheme: {
    background: '#f4f3f0',
    surface: '#ffffff',
    text: '#20201e',
    accent: '#6c5ce7',
    border: '#d8d5ce',
    active: '#6c5ce7',
  },
  iconSize: 48,
  gridColumns: 3,
  density: 'COMFORTABLE',
  reuseExistingTab: true,
  searchOtherWindows: true,
  showActiveIndicator: true,
  showOpenIndicator: true,
  showTooltips: true,
  webDockEnabled: false,
  dockPosition: 'LEFT',
  dockIconSize: 32,
  dockMagnification: true,
  dockAutoHide: false,
  dockOpenMode: 'PINNED_TAB',
};

const EXAMPLES = [
  ['GitHub', 'https://github.com/', 'quick'],
  ['AWS Console', 'https://console.aws.amazon.com/', 'quick'],
  ['Jira', 'https://www.atlassian.com/software/jira', 'quick'],
  ['Gmail', 'https://mail.google.com/', 'quick'],
  ['ChatGPT', 'https://chatgpt.com/', 'quick'],
  ['YouTube Music', 'https://music.youtube.com/', 'me'],
  ['NotebookLM', 'https://notebooklm.google.com/', 'me'],
  ['Cloudflare', 'https://dash.cloudflare.com/', 'work'],
  ['Notion', 'https://www.notion.so/', 'work'],
] as const;

export function createDefaultState(now = new Date().toISOString()): DockTabsState {
  const groups: ShortcutGroup[] = [
    { id: 'quick', title: 'Quick', position: 0, collapsed: false, createdAt: now, updatedAt: now },
    { id: 'me', title: 'Me', position: 1, collapsed: false, createdAt: now, updatedAt: now },
    { id: 'work', title: 'Work', position: 2, collapsed: false, createdAt: now, updatedAt: now },
  ];
  const counts = new Map<string, number>();
  const shortcuts: Shortcut[] = EXAMPLES.map(([title, url, groupId], index) => {
    const position = counts.get(groupId) ?? 0;
    counts.set(groupId, position + 1);
    return {
      id: `example-${index + 1}`,
      title,
      url,
      groupId,
      position,
      icon: null,
      matchStrategy: 'EXACT',
      createdAt: now,
      updatedAt: now,
    };
  });
  return { schemaVersion: 1, revision: 0, groups, shortcuts, preferences: DEFAULT_PREFERENCES, updatedAt: now };
}
