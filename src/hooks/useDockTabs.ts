import { useCallback, useEffect, useRef, useState } from 'react';
import { getTabs } from '../services/chrome';
import { loadState, saveState, subscribeState } from '../storage/repository';
import type { DockTabsState, TabSnapshot } from '../types/models';

type DockTabsModel = {
  state: DockTabsState | null;
  tabs: TabSnapshot[];
  error: string | null;
  loading: boolean;
  updateState: (updater: (current: DockTabsState) => DockTabsState) => void;
  refreshTabs: () => Promise<void>;
  clearError: () => void;
};

export function useDockTabs(): DockTabsModel {
  const [state, setState] = useState<DockTabsState | null>(null);
  const [tabs, setTabs] = useState<TabSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef<DockTabsState | null>(null);

  const refreshTabs = useCallback(async (): Promise<void> => {
    try {
      setTabs(await getTabs());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not read Chrome tabs.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadState(), getTabs()]).then(([loadedState, loadedTabs]) => {
      if (!active) return;
      stateRef.current = loadedState;
      setState(loadedState);
      setTabs(loadedTabs);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'DockTabs could not start.');
    });
    const unsubscribeState = subscribeState((next) => { if (active) { stateRef.current = next; setState(next); } });
    const onMessage = (message: unknown): void => {
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'tabs/changed') void refreshTabs();
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      active = false;
      unsubscribeState();
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [refreshTabs]);

  const updateState = useCallback((updater: (current: DockTabsState) => DockTabsState): void => {
    const current = stateRef.current;
    if (current === null) return;
    const next = updater(current);
    if (next === current) return;
    stateRef.current = next;
    setState(next);
    writeQueue.current = writeQueue.current.then(() => saveState(next)).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Your change could not be saved.');
    });
  }, []);

  return { state, tabs, error, loading: state === null && error === null, updateState, refreshTabs, clearError: () => setError(null) };
}
