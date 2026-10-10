import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ChartLanguage, chartLanguage } from '../core/lang/language';
import { displayName, sortName } from '../core/model/names';
import { Notice } from '../core/model/notice';
import { Person } from '../core/model/types';
import { Preferences } from '../state/preferences';
import { LOCALES, Locale, MessageKey, findLocale } from './locales';
import { MessageParams, formatMessage } from './message';

/**
 * Translations for the app. `t` reads the current language from a signal, so
 * templates and computed values that use it update when the language changes.
 *
 *   protected readonly t = inject(I18n).t;
 *   {{ t('file.save') }}   {{ t('people.count', { count: 3 }) }}
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly prefs = inject(Preferences);

  readonly locales = LOCALES;
  private readonly current = signal<Locale>(initialLocale(this.prefs.read().language));
  readonly locale = this.current.asReadonly();
  readonly code = computed(() => this.current().code);

  /** Dates and lifespans in the app's language, borrowed from the chart language pack. */
  readonly dates = computed<ChartLanguage>(() => chartLanguage(this.code()));
  private readonly plurals = computed(() => new Intl.PluralRules(this.current().intl));
  private readonly collator = computed(() => new Intl.Collator(this.current().intl, { sensitivity: 'base' }));
  private readonly lists = computed(() => listFormat(this.current().intl));

  /** The message for `key` in the app's language, with the parameters filled in. */
  readonly t = (key: MessageKey, params?: MessageParams): string => formatMessage(this.current().messages[key], params, this.plurals());

  constructor() {
    effect(() => {
      if (typeof document !== 'undefined') document.documentElement.lang = this.code();
    });
  }

  setLanguage(code: string): void {
    const locale = findLocale(code);
    if (!locale) return;
    this.current.set(locale);
    this.prefs.set({ language: locale.code });
  }

  /** The message for `key` when the catalogue has one, else `fallback` (for names supplied by plug-ins such as print styles). */
  textOr(key: string, fallback: string): string {
    return key in this.current().messages ? this.t(key as MessageKey) : fallback;
  }

  /** A notice from the core in the app's language: the message `prefix + code`, or its English text. */
  notice(n: Notice, prefix = ''): string {
    const key = prefix + n.code;
    return key in this.current().messages ? this.t(key as MessageKey, n.params) : n.text;
  }

  /** "Anna, Bob and Cyril" in the app's language. */
  list(items: readonly string[]): string {
    return this.lists()(items);
  }

  /** Compares names for sorting in the app's language. */
  compare = (a: string, b: string): number => this.collator().compare(a, b);

  /** "1898 – 1971", "b. 1993". */
  lifespan(person: Pick<Person, 'birth' | 'death'>): string {
    return this.dates().lifespan(person);
  }

  /** "Anna Hartmann", or "Unknown Hartmann" ("Neznámá Hartmannová") when nobody knows the given name. */
  name(person: Person | undefined): string {
    return displayName(person, this.unknown(person));
  }

  /** "Hartmann, Anna" for lists, with the same word for a given name nobody knows. */
  sortName(person: Person): string {
    return sortName(person, this.unknown(person));
  }

  private unknown(person: Person | undefined): string {
    return this.dates().unknown(person?.sex ?? 'unknown');
  }
}

function initialLocale(saved: string | undefined): Locale {
  const fromPrefs = findLocale(saved);
  if (fromPrefs) return fromPrefs;
  const browser = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const tag of browser) {
    const locale = findLocale(tag);
    if (locale) return locale;
  }
  return LOCALES[0];
}

function listFormat(intl: string): (items: readonly string[]) => string {
  try {
    const f = new Intl.ListFormat(intl, { style: 'long', type: 'conjunction' });
    return (items) => f.format(items);
  } catch {
    return (items) => items.join(', ');
  }
}
