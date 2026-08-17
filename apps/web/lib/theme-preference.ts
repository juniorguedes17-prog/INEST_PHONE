export type ThemePreference = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'inest.theme';
export const THEME_CHANGE_EVENT = 'inest:theme-change';

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'dark' ? 'dark' : 'light';
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyThemePreference(value: unknown): ThemePreference {
  const theme = normalizeThemePreference(value);

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: theme }));
  }

  return theme;
}
