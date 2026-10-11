import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import { createDefaultState } from '../../domain/defaults';
import { removeGroup, upsertGroup } from '../../domain/state';
import { createBackup, downloadBackup, parseBackup } from '../../features/import-export/backup';
import { importVivaldiCandidates, parseVivaldiBookmarks } from '../../features/import-export/vivaldi';
import { useTheme } from '../../features/theme/useTheme';
import { useDockTabs } from '../../hooks/useDockTabs';
import { sendMessage } from '../../services/chrome';
import { saveState } from '../../storage/repository';
import type { DockOpenMode, DockTabsState, ImportCandidate, Preferences, ShortcutGroup } from '../../types/models';

type PendingImport = { kind: 'backup'; state: DockTabsState } | { kind: 'vivaldi'; candidates: ImportCandidate[] };
const WEB_DOCK_ORIGINS = ['http://*/*', 'https://*/*'];
const DOCK_OPEN_MODES: readonly [DockOpenMode, string, string][] = [
  ['PINNED_TAB', 'Pinned tab', 'Sites become compact pinned tabs at the start of the tab strip. Clicking the Dock icon again returns to the same tab.'],
  ['APP_WINDOW', 'App window', 'Sites open in their own window without tabs, like macOS apps. Clicking the Dock icon again brings that window back until you close it.'],
  ['TAB', 'Tab', 'Sites open as regular tabs.'],
];

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }): React.JSX.Element {
  return <label className="setting-row"><span><strong>{label}</strong><small>{hint}</small></span><input className="switch" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }): React.JSX.Element {
  return <section className="settings-card"><header><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></header>{children}</section>;
}

function DockPreview({ state }: { state: DockTabsState }): React.JSX.Element {
  const position = state.preferences.dockPosition.toLocaleLowerCase();
  const groupOrder = new Map(state.groups.map((group) => [group.id, group.position]));
  const shortcuts = [...state.shortcuts]
    .sort((a, b) => (groupOrder.get(a.groupId) ?? 0) - (groupOrder.get(b.groupId) ?? 0) || a.position - b.position)
    .slice(0, 3);
  const previewSize = Math.round(Math.max(24, Math.min(38, state.preferences.dockIconSize * .72)));
  const previewStyle = { '--dock-preview-size': `${previewSize}px` } as CSSProperties;
  const previewLabel = `Dock preview: ${position}, ${state.preferences.dockIconSize} pixels, auto-hide ${state.preferences.dockAutoHide ? 'on' : 'off'}`;

  return <div className="dock-preview-block">
    <div className="dock-preview-copy"><strong>Live preview</strong><span>{state.preferences.dockAutoHide ? 'Auto-hide on' : 'Always visible'} · {state.preferences.dockIconSize}px</span></div>
    <div className={`dock-preview-stage ${position} ${state.preferences.webDockEnabled ? '' : 'disabled'}`} role="img" aria-label={previewLabel}>
      <div className="dock-preview-rail" style={previewStyle} aria-hidden="true">
        {shortcuts.map((shortcut) => <span className="dock-preview-item" key={shortcut.id}>
          {shortcut.icon !== null && shortcut.icon !== 'INITIALS' && <img src={shortcut.icon} alt="" onError={(event) => event.currentTarget.remove()} />}
          <span>{shortcut.title.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('')}</span>
        </span>)}
        <span className="dock-preview-separator" />
        <span className="dock-preview-item dock-preview-control">✎</span>
        <span className="dock-preview-item dock-preview-control">+</span>
        <span className="dock-preview-item dock-preview-control">⚙</span>
      </div>
    </div>
  </div>;
}

export function App(): React.JSX.Element {
  const model = useDockTabs();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [newGroup, setNewGroup] = useState('');
  useTheme(model.state?.preferences ?? null);

  useEffect(() => {
    if (model.state?.preferences.webDockEnabled !== true) return;
    void chrome.permissions.contains({ origins: WEB_DOCK_ORIGINS }).then((granted) => {
      if (granted) return;
      model.updateState((current) => ({ ...current, revision: current.revision + 1, preferences: { ...current.preferences, webDockEnabled: false }, updatedAt: new Date().toISOString() }));
      setNotice('Web Dock was turned off because website access is no longer granted.');
    }).catch(() => undefined);
  }, [model.state?.preferences.webDockEnabled, model.updateState]);

  if (model.loading) return <main className="center-state"><img className="brand-mark" src={chrome.runtime.getURL('icons/icon128.png')} alt="" /><p>Loading settings…</p></main>;
  if (model.state === null) return <main className="center-state error-state"><h1>Settings unavailable</h1><p>{model.error}</p></main>;
  const state = model.state;
  const updatePreferences = (patch: Partial<Preferences>): void => model.updateState((current) => ({ ...current, revision: current.revision + 1, preferences: { ...current.preferences, ...patch }, updatedAt: new Date().toISOString() }));
  const readText = async (event: ChangeEvent<HTMLInputElement>, kind: 'backup' | 'vivaldi'): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    try {
      const text = await file.text();
      setPending(kind === 'backup' ? { kind, state: parseBackup(text) } : { kind, candidates: parseVivaldiBookmarks(text, state.shortcuts) });
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'The file could not be read.'); }
  };
  const confirmImport = (): void => {
    if (pending === null) return;
    if (pending.kind === 'backup') model.updateState(() => ({ ...pending.state, revision: pending.state.revision + 1, updatedAt: new Date().toISOString() }));
    else model.updateState((current) => importVivaldiCandidates(current, pending.candidates));
    setNotice(pending.kind === 'backup' ? 'Backup restored.' : 'Bookmarks imported.');
    setPending(null);
  };
  const addGroup = (): void => {
    const title = newGroup.trim();
    if (title === '' || title.length > 80) return;
    const now = new Date().toISOString();
    model.updateState((current) => upsertGroup(current, { id: crypto.randomUUID(), title, position: current.groups.length, collapsed: false, createdAt: now, updatedAt: now }, now));
    setNewGroup('');
  };
  const renameGroup = (group: ShortcutGroup): void => {
    const title = window.prompt('Group name', group.title)?.trim();
    if (title === undefined || title === '' || title.length > 80) return;
    model.updateState((current) => upsertGroup(current, { ...group, title, updatedAt: new Date().toISOString() }));
  };
  const deleteGroup = (group: ShortcutGroup): void => {
    const target = state.groups.find((item) => item.id !== group.id);
    if (target === undefined) { setNotice('DockTabs must keep at least one group.'); return; }
    if (!window.confirm(`Remove “${group.title}” and move its shortcuts to “${target.title}”?`)) return;
    model.updateState((current) => removeGroup(current, group.id, target.id));
  };
  const setWebDockEnabled = async (enabled: boolean): Promise<void> => {
    try {
      if (enabled) {
        const granted = await chrome.permissions.request({ origins: WEB_DOCK_ORIGINS });
        if (!granted) { setNotice('Web Dock needs website access to appear inside pages. No permission was changed.'); return; }
      }
      const now = new Date().toISOString();
      const next = { ...state, revision: state.revision + 1, preferences: { ...state.preferences, webDockEnabled: enabled }, updatedAt: now };
      await saveState(next);
      model.updateState(() => next);
      await sendMessage<undefined>({ type: 'dock/sync', enabled });
      if (!enabled) await chrome.permissions.remove({ origins: WEB_DOCK_ORIGINS });
      setNotice(enabled ? 'Compact Web Dock is now active on regular websites.' : 'Web Dock disabled and website access removed.');
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Web Dock could not be updated.'); }
  };

  return <main className="settings-shell">
    <header className="settings-hero"><img className="brand-mark large" src={chrome.runtime.getURL('icons/icon128.png')} alt="DockTabs" /><div><span className="eyebrow">Chrome Web Dock</span><h1>DockTabs Settings</h1><p>Your dock, icons, and favorites stay local to this Chrome profile.</p></div></header>
    {notice !== null && <div className="notice success"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Dismiss</button></div>}
    <div className="settings-grid">
      <Section eyebrow="Web Dock" title="Dock">
        <div className="dock-settings">
          <Toggle label="Compact Web Dock" hint="Show a macOS-style single-row dock inside permitted websites." checked={state.preferences.webDockEnabled} onChange={(value) => { void setWebDockEnabled(value); }} />
          {state.preferences.webDockEnabled && <>
            <div className="field"><span>Position</span><div className="position-picker">{(['LEFT', 'RIGHT', 'TOP', 'BOTTOM'] as const).map((position) => <button key={position} className={state.preferences.dockPosition === position ? 'selected' : ''} type="button" onClick={() => updatePreferences({ dockPosition: position })}><span className={`position-mark ${position.toLocaleLowerCase()}`} />{position[0]}{position.slice(1).toLocaleLowerCase()}</button>)}</div></div>
            <label className="field">Dock size <span>{state.preferences.dockIconSize}px</span><input type="range" min="28" max="56" step="2" value={state.preferences.dockIconSize} onChange={(event) => updatePreferences({ dockIconSize: Number(event.target.value) })} /></label>
            <div className="size-presets"><button type="button" className={state.preferences.dockIconSize === 28 ? 'selected' : ''} onClick={() => updatePreferences({ dockIconSize: 28 })}>Small</button><button type="button" className={state.preferences.dockIconSize === 40 ? 'selected' : ''} onClick={() => updatePreferences({ dockIconSize: 40 })}>Medium</button><button type="button" className={state.preferences.dockIconSize === 52 ? 'selected' : ''} onClick={() => updatePreferences({ dockIconSize: 52 })}>Large</button></div>
            <Toggle label="Magnification" hint="Gently enlarge the icon under the pointer." checked={state.preferences.dockMagnification} onChange={(value) => updatePreferences({ dockMagnification: value })} />
            <Toggle label="Auto-hide" hint="Keep only a small edge visible until you point at it." checked={state.preferences.dockAutoHide} onChange={(value) => updatePreferences({ dockAutoHide: value })} />
          </>}
          <DockPreview state={state} />
        </div>
      </Section>
      <Section eyebrow="Library" title="Favorites & groups">
        <p className="helper">Use the <strong>+</strong> button on the Web Dock to save the current site. Drag Dock icons to reorder them; Option/Alt + arrow keys provide the keyboard alternative. Each favicon is stored permanently with its shortcut.</p>
        <div className="group-list">{[...state.groups].sort((a, b) => a.position - b.position).map((group) => <div key={group.id}><span><strong>{group.title}</strong><small>{state.shortcuts.filter((item) => item.groupId === group.id).length} shortcuts</small></span><button type="button" onClick={() => renameGroup(group)}>Rename</button><button className="danger-item" type="button" onClick={() => deleteGroup(group)}>Remove</button></div>)}</div>
        <div className="inline-form"><input value={newGroup} maxLength={80} placeholder="New group name" onChange={(event) => setNewGroup(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addGroup(); }} /><button className="secondary-button" type="button" onClick={addGroup}>Create group</button></div>
      </Section>
      <Section eyebrow="Behavior" title="Opening">
        <div className="field" role="group" aria-labelledby="dock-open-mode-label" aria-describedby="dock-open-mode-hint">
          <span id="dock-open-mode-label">Dock opens sites as</span>
          <div className="size-presets">{DOCK_OPEN_MODES.map(([mode, label]) => <button key={mode} type="button" aria-pressed={state.preferences.dockOpenMode === mode} className={state.preferences.dockOpenMode === mode ? 'selected' : ''} onClick={() => updatePreferences({ dockOpenMode: mode })}>{label}</button>)}</div>
          <small id="dock-open-mode-hint">{DOCK_OPEN_MODES.find(([mode]) => mode === state.preferences.dockOpenMode)?.[2]}</small>
        </div>
        <Toggle label="Reuse matching tabs" hint="Focus an existing match instead of creating a duplicate." checked={state.preferences.reuseExistingTab} onChange={(value) => updatePreferences({ reuseExistingTab: value })} />
        <Toggle label="Search other windows" hint="Look beyond the current Chrome window for matches." checked={state.preferences.searchOtherWindows} onChange={(value) => updatePreferences({ searchOtherWindows: value })} />
      </Section>
      <Section eyebrow="Portable" title="Import & export">
        <div className="action-stack"><button className="secondary-button" type="button" onClick={() => downloadBackup(state)}>Export JSON backup</button><label className="file-button">Import JSON backup<input type="file" accept="application/json,.json" onChange={(event) => { void readText(event, 'backup'); }} /></label><label className="file-button">Import Vivaldi bookmarks<input type="file" accept="text/html,.html" onChange={(event) => { void readText(event, 'vivaldi'); }} /></label></div>
        <p className="helper">Files are parsed locally. Nothing is uploaded.</p>
      </Section>
      <Section eyebrow="Privacy" title="Local data">
        <p className="privacy-copy">DockTabs stores preferences and shortcuts in <code>chrome.storage.local</code>. It does not use analytics, remote scripts, or a server.</p>
        <p className="privacy-copy">Permissions: <code>tabs</code>, <code>storage</code>, <code>favicon</code>, and <code>scripting</code>. Website origins are optional, requested only when Web Dock is enabled, and removed when it is disabled. No side-panel, cookie, history, or web-request permission is requested.</p>
        <button className="danger-button" type="button" onClick={() => { if (window.confirm('Reset all DockTabs data to the built-in examples?')) model.updateState(() => createDefaultState()); }}>Reset extension data</button>
      </Section>
    </div>
    <footer className="settings-footer">DockTabs 1.0 · {state.shortcuts.length} shortcuts · backup schema {createBackup(state).version}</footer>
    {pending !== null && <div className="dialog-backdrop"><div className="dialog import-preview" role="dialog" aria-modal="true"><header><div><span className="eyebrow">Review</span><h2>{pending.kind === 'backup' ? 'Restore backup?' : 'Import bookmarks?'}</h2></div></header>{pending.kind === 'backup' ? <p>This will replace your current {state.shortcuts.length} shortcuts with {pending.state.shortcuts.length} shortcuts in {pending.state.groups.length} groups.</p> : <><p>{pending.candidates.filter((item) => !item.duplicate).length} new bookmarks are ready. {pending.candidates.filter((item) => item.duplicate).length} duplicates will be skipped.</p><div className="preview-list">{pending.candidates.slice(0, 100).map((item) => <div key={item.sourceId} className={item.duplicate ? 'duplicate' : ''}><span>{item.title}</span><small>{item.groupTitle}{item.duplicate ? ' · duplicate' : ''}</small></div>)}</div></>}<footer><button className="secondary-button" type="button" onClick={() => setPending(null)}>Cancel</button><button className="primary-button" type="button" onClick={confirmImport}>Confirm import</button></footer></div></div>}
  </main>;
}
