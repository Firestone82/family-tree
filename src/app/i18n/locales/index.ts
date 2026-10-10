/**
 * The languages of the app. To add one:
 *
 *   1. Copy en.ts to xx.ts and translate it. It is typed against English, so
 *      the build fails until every message is there.
 *   2. Add it to LOCALES below.
 *   3. For dates in that language (and for the words on the chart), add a
 *      chart language pack in core/lang. Without one, dates use English.
 */
import { Catalogue } from './en';
import { cs } from './cs';
import { en } from './en';

export interface Locale {
  /** BCP 47 language code, e.g. "en". */
  code: string;
  /** The language's name in itself, for the language switch. */
  name: string;
  /** Locale for Intl (plurals, sorting, lists). */
  intl: string;
  messages: Catalogue;
}

export const LOCALES: readonly Locale[] = [
  { code: 'en', name: 'English', intl: 'en-GB', messages: en },
  { code: 'cs', name: 'Čeština', intl: 'cs-CZ', messages: cs },
];

/** The locale for a language tag; "cs-CZ" finds Czech. */
export function findLocale(tag: string | null | undefined): Locale | undefined {
  const t = (tag ?? '').toLowerCase();
  if (!t) return undefined;
  return LOCALES.find((l) => l.code === t) ?? LOCALES.find((l) => l.code === t.split('-')[0]);
}

export type { Catalogue, MessageKey } from './en';
