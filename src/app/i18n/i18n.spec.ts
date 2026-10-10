import { TestBed } from '@angular/core/testing';
import { notice } from '../core/model/notice';
import { I18n } from './i18n';
import { LOCALES, MessageKey, findLocale } from './locales';
import { en } from './locales/en';
import { Message, formatMessage } from './message';

/** The {placeholders} a message uses, over all its plural forms. */
function placeholders(m: Message): Set<string> {
  const texts = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
  return new Set(texts.flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((x) => x[1])));
}

describe('messages', () => {
  it('fills in parameters and picks the plural form of the language', () => {
    const czech = new Intl.PluralRules('cs-CZ');
    const people = { one: '{count} osoba', few: '{count} osoby', other: '{count} osob' };
    expect(formatMessage(people, { count: 1 }, czech)).toBe('1 osoba');
    expect(formatMessage(people, { count: 3 }, czech)).toBe('3 osoby');
    expect(formatMessage(people, { count: 5 }, czech)).toBe('5 osob');
    expect(formatMessage(people, { count: 0 }, czech)).toBe('0 osob');
    // A form the message does not give falls back to "other"; unknown placeholders are left alone.
    expect(formatMessage({ one: 'one {count}', other: 'many {count}' }, { count: 3 }, czech)).toBe('many 3');
    expect(formatMessage('Hello {name} {missing}', { name: 'Anna' }, czech)).toBe('Hello Anna {missing}');
    expect(formatMessage(undefined, {}, czech)).toBe('');
  });

  it('has every language complete, using the same placeholders as English', () => {
    const keys = Object.keys(en) as MessageKey[];
    for (const locale of LOCALES) {
      expect(Object.keys(locale.messages).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        const translated = locale.messages[key];
        expect(translated, `${locale.code} ${key}`).toBeTruthy();
        expect([...placeholders(translated)].sort(), `${locale.code} ${key}`).toEqual([...placeholders(en[key])].sort());
        if (typeof translated !== 'string') expect(translated.other, `${locale.code} ${key}`).toBeTruthy();
      }
    }
  });

  it('finds a language by its tag', () => {
    expect(findLocale('cs-CZ')?.code).toBe('cs');
    expect(findLocale('EN')?.code).toBe('en');
    expect(findLocale('de')).toBeUndefined();
    expect(findLocale('')).toBeUndefined();
  });
});

describe('I18n', () => {
  beforeEach(() => localStorage.clear());

  it('switches language, remembers it, and falls back to the English text of a notice', () => {
    const i18n = TestBed.inject(I18n);
    i18n.setLanguage('en');
    expect(i18n.t('file.save')).toBe('Save as XML');
    expect(i18n.t('overview.people', { count: 2 })).toBe('2 people');

    i18n.setLanguage('cs');
    expect(i18n.code()).toBe('cs');
    expect(i18n.t('file.save')).toBe('Uložit jako XML');
    expect(i18n.t('overview.people', { count: 2 })).toBe('2 osoby');
    expect(JSON.parse(localStorage.getItem('stemma.prefs.v1') ?? '{}').language).toBe('cs');
    // Czech keeps "a" on the line with the next name, with a no-break space.
    expect(i18n.list(['Anna', 'Bára', 'Cyril']).replace(/\s/g, ' ')).toBe('Anna, Bára a Cyril');

    // Notices from the core: translated when there is a message, else their English text.
    expect(i18n.notice(notice('two-parents', 'Simon already has two parents.', { child: 'Simon' }), 'op.')).toBe('Simon už má dva rodiče.');
    expect(i18n.notice(notice('brand-new', 'Something new happened.'), 'op.')).toBe('Something new happened.');
    // Names supplied from elsewhere, such as print styles from a plug-in.
    expect(i18n.textOr('theme.modern.name', 'Modern')).toBe('Moderní');
    expect(i18n.textOr('theme.unknown.name', 'Unknown')).toBe('Unknown');

    i18n.setLanguage('xx');
    expect(i18n.code()).toBe('cs');
  });
});
