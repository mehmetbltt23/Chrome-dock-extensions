import { parseState } from '../../storage/validation';
import type { DockTabsBackup, DockTabsState } from '../../types/models';
import { DockTabsError } from '../../domain/errors';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function createBackup(state: DockTabsState, now = new Date().toISOString()): DockTabsBackup {
  return { format: 'docktabs-backup', version: 1, exportedAt: now, state };
}

export function parseBackup(text: string): DockTabsState {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new DockTabsError('IMPORT_INVALID', 'Backup files must be 5 MB or smaller.');
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new DockTabsError('IMPORT_INVALID', 'The backup is not valid JSON.'); }
  if (typeof parsed !== 'object' || parsed === null || !('format' in parsed) || parsed.format !== 'docktabs-backup' || !('version' in parsed) || parsed.version !== 1 || !('state' in parsed)) {
    throw new DockTabsError('IMPORT_INVALID', 'This is not a supported DockTabs backup.');
  }
  return parseState(parsed.state);
}

export function downloadBackup(state: DockTabsState): void {
  const blob = new Blob([JSON.stringify(createBackup(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `docktabs-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
