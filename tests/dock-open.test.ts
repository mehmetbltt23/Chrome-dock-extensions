import { describe, expect, it } from 'vitest';
import { dockOpenMessage } from '../src/domain/dock-open';
import { createDefaultState } from '../src/domain/defaults';
import { isAppMessage } from '../src/services/message-validation';

const state = createDefaultState();
const shortcut = state.shortcuts[0];
if (shortcut === undefined) throw new Error('Default state must contain an example shortcut.');

describe('Dock open requests', () => {
  it('maps each open mode to exactly one window behavior', () => {
    const forMode = (dockOpenMode: 'PINNED_TAB' | 'APP_WINDOW' | 'TAB') => dockOpenMessage(shortcut, { ...state.preferences, dockOpenMode });
    expect(forMode('PINNED_TAB')).toMatchObject({ appWindow: false, pinTab: true });
    expect(forMode('APP_WINDOW')).toMatchObject({ appWindow: true, pinTab: false });
    expect(forMode('TAB')).toMatchObject({ appWindow: false, pinTab: false });
  });
  it('produces requests the service worker accepts', () => {
    expect(isAppMessage(dockOpenMessage(shortcut, state.preferences))).toBe(true);
    expect(isAppMessage({ type: 'launcher/close' })).toBe(true);
  });
});
