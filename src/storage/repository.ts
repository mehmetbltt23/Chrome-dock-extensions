import { createDefaultState } from '../domain/defaults';
import type { DockTabsState } from '../types/models';
import { migrateState, parseState } from './validation';

export const STORAGE_KEY = 'docktabs.state';

export async function loadState(): Promise<DockTabsState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const raw = stored[STORAGE_KEY];
  if (raw === undefined) {
    const initial = createDefaultState();
    await chrome.storage.local.set({ [STORAGE_KEY]: initial });
    return initial;
  }
  const migrated = migrateState(raw);
  if (isMigrated(raw, migrated)) await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
  return migrated;
}

function isMigrated(raw: unknown, state: DockTabsState): boolean {
  return typeof raw === 'object' && raw !== null && 'schemaVersion' in raw && raw.schemaVersion !== state.schemaVersion;
}

export async function saveState(state: DockTabsState): Promise<void> {
  const validated = parseState(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: validated });
}

export function subscribeState(listener: (state: DockTabsState) => void): () => void {
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== 'local' || changes[STORAGE_KEY]?.newValue === undefined) return;
    try {
      listener(migrateState(changes[STORAGE_KEY].newValue));
    } catch {
      // Keep the last valid in-memory state. The UI reports future write errors.
    }
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
