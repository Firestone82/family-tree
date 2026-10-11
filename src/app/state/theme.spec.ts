import { TestBed } from '@angular/core/testing';
import { Theme, themeChoice } from './theme';

describe('light and dark', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
  });

  it('follows the device until something is chosen', () => {
    const theme = TestBed.inject(Theme);
    expect(theme.choice()).toBe('auto');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('puts the choice on the page and remembers it in this browser', () => {
    const theme = TestBed.inject(Theme);
    theme.set('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(JSON.parse(localStorage.getItem('stemma.prefs.v1') ?? '{}').theme).toBe('dark');
    theme.set('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    theme.set('auto');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('reads back only the choices it knows', () => {
    expect(themeChoice('dark')).toBe('dark');
    expect(themeChoice('light')).toBe('light');
    // The chart styles of earlier versions were saved with the tree, not here.
    expect(themeChoice('night')).toBe('auto');
    expect(themeChoice(undefined)).toBe('auto');
  });
});
