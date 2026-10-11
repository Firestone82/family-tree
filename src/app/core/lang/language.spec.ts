import { RELATIONSHIP_STATUSES, relationshipStatus } from '../model/relationship';
import { Family, Person, Sex } from '../model/types';
import { chartLanguage, LANGUAGES, surnameLinesIn } from './language';

function fam(extra: Partial<Family>): Family {
  return { id: 'F1', kind: 'marriage', partners: ['A', 'B'], children: [], ...extra };
}

describe('chart languages', () => {
  const en = chartLanguage('en');
  const cs = chartLanguage('cs');

  it('finds languages by tag and falls back to English', () => {
    expect(chartLanguage('cs-CZ').code).toBe('cs');
    expect(chartLanguage('de').code).toBe('en');
    expect(chartLanguage(undefined).code).toBe('en');
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'cs']);
  });

  it('writes full dates', () => {
    expect(en.fullDate({ value: '1923-05-17' })).toBe('17 May 1923');
    expect(en.fullDate({ value: '1923-05', qualifier: 'about' })).toBe('about May 1923');
    expect(cs.fullDate({ value: '1923-05-17' })).toBe('17. května 1923');
    expect(cs.fullDate({ value: '1923-05' })).toBe('květen 1923');
    expect(cs.fullDate({ value: '1900', qualifier: 'before' })).toBe('před 1900');
    expect(cs.fullDate({ value: '', text: 'jaro 1900' })).toBe('jaro 1900');
    expect(en.fullDate(undefined)).toBe('');
  });

  it('notes how every couple stands, without dates or places', () => {
    const married = fam({ start: { date: { value: '1952-07-19' }, place: 'Lyon, France' } });
    expect(en.union(relationshipStatus(married))).toBe('married');
    expect(cs.union(relationshipStatus(married))).toBe('manželé');

    const divorced = fam({ start: { date: { value: '1979' } }, end: { reason: 'divorce', date: { value: '1988' } } });
    expect(en.union(relationshipStatus(divorced))).toBe('divorced');
    expect(cs.union(relationshipStatus(divorced))).toBe('rozvedeni');

    const engaged = fam({ kind: 'partnership', engagement: { date: { value: '2024-12-24' }, place: 'Prague, Czechia' } });
    expect(relationshipStatus(engaged)).toBe('engaged');
    expect(en.union('engaged')).toBe('engaged');
    expect(cs.union('engaged')).toBe('zasnoubení');
    expect(en.union('partners')).toBe('partners');
    expect(en.union('widowed')).toBe('widowed');

    // Every status a couple can be given has a note, in every language; only "not known" has none.
    for (const language of LANGUAGES) {
      for (const status of RELATIONSHIP_STATUSES) {
        if (status === 'unknown') expect(language.union(status)).toBe('');
        else expect(language.union(status), `${language.code} ${status}`).not.toBe('');
      }
    }
  });

  it('puts the surname at birth on a line of its own', () => {
    const person = (surname: string, birthSurname?: string, sex: Sex = 'female'): Person => ({ id: 'P', sex, name: { given: 'Věra', surname, birthSurname } });
    expect(surnameLinesIn(en, person('Nováková', 'Dvořáková'))).toEqual({ surname: 'Nováková', birth: 'née Dvořáková' });
    expect(surnameLinesIn(cs, person('Nováková', 'Dvořáková'))).toEqual({ surname: 'Nováková', birth: 'roz. Dvořáková' });
    // Known from elsewhere: the father's surname.
    expect(surnameLinesIn(en, person('Ashworth', undefined, 'male'), 'Moreau')).toEqual({ surname: 'Ashworth', birth: 'né Moreau' });
    // Nothing under a surname that did not change; only the surname at birth known: that is the surname.
    expect(surnameLinesIn(en, person('Ashworth', 'Ashworth'))).toEqual({ surname: 'Ashworth', birth: '' });
    expect(surnameLinesIn(en, person('', 'Barlow'))).toEqual({ surname: 'Barlow', birth: '' });
  });

  it('writes lifespans and dates', () => {
    expect(en.lifespan({ birth: { date: { value: '1993' } } })).toBe('b. 1993');
    expect(cs.lifespan({ birth: { date: { value: '1993' } } })).toBe('* 1993');
    expect(cs.lifespan({ birth: { date: { value: '1900', qualifier: 'about' } }, death: {} })).toBe('kol. 1900 – †');
    expect(en.longDate(new Date(2026, 9, 10))).toBe('10 October 2026');
    expect(cs.longDate(new Date(2026, 9, 10))).toBe('10. října 2026');
  });

  it('calls someone whose name nobody knows Unknown', () => {
    expect(en.unknown('female')).toBe('Unknown');
    expect(cs.unknown('female')).toBe('Neznámá');
    expect(cs.unknown('male')).toBe('Neznámý');
    expect(cs.unknown('unknown')).toBe('Neznámý');
  });

  it('counts in each language', () => {
    expect(en.summary(5, 29)).toBe('Five generations, 29 people');
    expect(en.summary(1, 1)).toBe('One generation, 1 person');
    expect(cs.summary(5, 29)).toBe('5 generací, 29 osob');
    expect(cs.summary(3, 4)).toBe('3 generace, 4 osoby');
    expect(cs.summary(1, 1)).toBe('1 generace, 1 osoba');
  });
});
