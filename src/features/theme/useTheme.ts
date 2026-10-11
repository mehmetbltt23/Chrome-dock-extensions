import { useEffect } from 'react';
import type { Preferences } from '../../types/models';

export function resolveTheme(mode: Preferences['themeMode'], prefersDark: boolean): Exclude<Preferences['themeMode'], 'AUTO'> {
  return mode === 'AUTO' ? (prefersDark ? 'DARK' : 'LIGHT') : mode;
}

export function useTheme(preferences: Preferences | null): void {
  useEffect(() => {
    if (preferences === null) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      const resolved = resolveTheme(preferences.themeMode, query.matches);
      document.documentElement.dataset.theme = resolved.toLowerCase();
      if (resolved === 'CUSTOM') {
        const root = document.documentElement.style;
        root.setProperty('--background', preferences.customTheme.background);
        root.setProperty('--surface', preferences.customTheme.surface);
        root.setProperty('--text-primary', preferences.customTheme.text);
        root.setProperty('--accent', preferences.customTheme.accent);
        root.setProperty('--border', preferences.customTheme.border);
        root.setProperty('--active-indicator', preferences.customTheme.active);
      } else {
        for (const property of ['--background', '--surface', '--text-primary', '--accent', '--border', '--active-indicator']) {
          document.documentElement.style.removeProperty(property);
        }
      }
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [preferences]);
}
