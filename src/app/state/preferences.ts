import { Injectable } from '@angular/core';

const KEY = 'stemma.prefs.v1';

/** Settings of this browser rather than of a tree. */
export interface Prefs {
  /** The person has seen and dismissed the note about the example family. */
  sampleNoteDismissed?: boolean;
  /** Language of the app and of the words on the chart and in prints, as a language code. */
  language?: string;
  /** Light or dark look of the app and the chart: 'auto' (follows the device), 'light' or 'dark'. */
  theme?: string;
}

/**
 * Small preferences kept in this browser. Storage may be unavailable (private
 * windows, blocked site data); the app then simply forgets them.
 */
@Injectable({ providedIn: 'root' })
export class Preferences {
  read(): Prefs {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs;
    } catch {
      return {};
    }
  }

  set(patch: Prefs): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...this.read(), ...patch }));
    } catch {
      // A convenience only.
    }
  }
}
