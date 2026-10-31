import { useSyncExternalStore } from 'react';

/**
 * Page theme of the demo: light by default whatever the system says; dark and
 * auto (follow `prefers-color-scheme`) are opt-in. The choice lives on
 * `<html data-theme>` (set before first paint by an inline script in each
 * index.html) and in localStorage, and is passed to every `<Timeline theme>`.
 */

export type PageTheme = 'light' | 'dark' | 'auto';

export const THEME_KEY = 'tw-demo-theme';
const CHANGE = 'tw-demo-theme-change';

const valid = (value: unknown): value is PageTheme => value === 'light' || value === 'dark' || value === 'auto';

function stored(): PageTheme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return valid(value) ? value : 'light';
  } catch {
    return 'light';
  }
}

/** Current page theme, as applied on `<html data-theme>`. */
export function getPageTheme(): PageTheme {
  if (typeof document === 'undefined') return 'light';
  const value = document.documentElement.dataset.theme;
  return valid(value) ? value : 'light';
}

function apply(theme: PageTheme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(CHANGE));
}

/** Applies and remembers the page theme. */
export function setPageTheme(theme: PageTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Storage unavailable (private mode, blocked site data): the choice lasts for this page only. */
  }
  apply(theme);
}

// Fallback when the inline script did not run.
if (typeof document !== 'undefined' && !valid(document.documentElement.dataset.theme)) {
  document.documentElement.dataset.theme = stored();
}

function subscribe(onChange: () => void) {
  // Another tab changed the theme: follow it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) apply(stored());
  };
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Current page theme ('light' | 'dark' | 'auto'), re-rendering on change. */
export function usePageTheme(): PageTheme {
  return useSyncExternalStore(subscribe, getPageTheme, () => 'light');
}
