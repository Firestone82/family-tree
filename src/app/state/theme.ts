import { Injectable, inject, signal } from '@angular/core';
import { Preferences } from './preferences';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['auto', 'dark', 'light'];

/** The colour of the browser's own bar around the app, as the page's paper. */
const BAR_COLOR: Record<'light' | 'dark', string> = { light: '#e9ece6', dark: '#13181c' };

/**
 * Light or dark look of the app and the chart, a setting of this browser:
 * Auto follows the device. The choice is put on the page as
 * `<html data-theme>`, which the design tokens and the chart's colours follow
 * (index.html sets it before the app starts, so a dark choice does not flash light).
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly prefs = inject(Preferences);
  private readonly current = signal<ThemeChoice>(themeChoice(this.prefs.read().theme));
  readonly choice = this.current.asReadonly();

  constructor() {
    applyTheme(this.current());
  }

  set(choice: ThemeChoice): void {
    this.current.set(choice);
    this.prefs.set({ theme: choice });
    applyTheme(choice);
  }
}

/** A saved choice, or Auto for anything else. */
export function themeChoice(saved: string | undefined): ThemeChoice {
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  // Each tag answers one colour scheme; a choice made here answers both with its colour.
  for (const meta of Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = BAR_COLOR[choice === 'auto' ? scheme : choice];
  }
}
