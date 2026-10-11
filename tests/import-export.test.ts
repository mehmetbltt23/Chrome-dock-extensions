import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/domain/defaults';
import { createBackup, parseBackup } from '../src/features/import-export/backup';
import { importVivaldiCandidates, parseVivaldiBookmarks } from '../src/features/import-export/vivaldi';

describe('local import and export', () => {
  it('round-trips a versioned JSON backup', () => {
    const state = createDefaultState('2026-01-01T00:00:00.000Z');
    expect(parseBackup(JSON.stringify(createBackup(state))).shortcuts).toEqual(state.shortcuts);
  });
  it('previews Vivaldi groups, flags duplicates and rejects unsafe URLs', () => {
    const state = createDefaultState();
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><dl><dt><h3>Quick</h3><dl><dt><a href="https://github.com/">GitHub</a></dt><dt><a href="https://example.com/docs">Docs</a></dt><dt><a href="javascript:alert(1)">Bad</a></dt></dl></dt></dl>`;
    const candidates = parseVivaldiBookmarks(html, state.shortcuts);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.duplicate).toBe(true);
    expect(candidates[1]?.duplicate).toBe(false);
  });
  it('imports only new candidates and creates their group once', () => {
    let id = 0;
    const state = createDefaultState();
    const next = importVivaldiCandidates(state, [
      { sourceId: '1', title: 'One', url: 'https://one.example/', groupTitle: 'Imported', duplicate: false },
      { sourceId: '2', title: 'Two', url: 'https://two.example/', groupTitle: 'Imported', duplicate: false },
      { sourceId: '3', title: 'Skip', url: 'https://skip.example/', groupTitle: 'Imported', duplicate: true },
    ], () => `id-${++id}`, '2026-01-01T00:00:00.000Z');
    expect(next.groups.filter((group) => group.title === 'Imported')).toHaveLength(1);
    expect(next.shortcuts.filter((item) => item.groupId === 'id-1').map((item) => item.title)).toEqual(['One', 'Two']);
  });
});
