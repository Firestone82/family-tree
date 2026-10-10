import { relationshipStatus } from '../model/relationship';
import { Family } from '../model/types';
import { chartLanguage, LANGUAGES } from './language';

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

  it('writes marriage notes', () => {
    const married = fam({ start: { date: { value: '1952-07-19' }, place: 'Lyon, France' } });
    expect(en.union(married, relationshipStatus(married))).toBe('m. 1952, Lyon, France');
    expect(cs.union(married, relationshipStatus(married))).toBe('sňatek 1952, Lyon, France');

    const divorced = fam({ start: { date: { value: '1979' } }, end: { reason: 'divorce', date: { value: '1988' } } });
    expect(en.union(divorced, relationshipStatus(divorced))).toBe('m. 1979, div. 1988');
    expect(cs.union(divorced, relationshipStatus(divorced))).toBe('sňatek 1979, rozvod 1988');

    const engaged = fam({ kind: 'partnership', engagement: { date: { value: '2024-12-24' } } });
    expect(relationshipStatus(engaged)).toBe('engaged');
    expect(en.union(engaged, 'engaged')).toBe('engaged 2024');
    expect(cs.union(engaged, 'engaged')).toBe('zasnoubení 2024');

    const placeOnly = fam({ start: { place: 'Brno' } });
    expect(en.union(placeOnly, 'married')).toBe('m. in Brno');
    expect(en.union(fam({}), 'married')).toBe('');
    expect(en.union(fam({ kind: 'partnership', start: { date: { value: '2019' } } }), 'partners')).toBe('together since 2019');
  });

  it('writes lifespans and dates', () => {
    expect(en.lifespan({ birth: { date: { value: '1993' } } })).toBe('b. 1993');
    expect(cs.lifespan({ birth: { date: { value: '1993' } } })).toBe('* 1993');
    expect(cs.lifespan({ birth: { date: { value: '1900', qualifier: 'about' } }, death: {} })).toBe('kol. 1900 – †');
    expect(en.longDate(new Date(2026, 9, 10))).toBe('10 October 2026');
    expect(cs.longDate(new Date(2026, 9, 10))).toBe('10. října 2026');
  });

  it('counts in each language', () => {
    expect(en.summary(5, 29)).toBe('Five generations, 29 people');
    expect(en.summary(1, 1)).toBe('One generation, 1 person');
    expect(cs.summary(5, 29)).toBe('5 generací, 29 osob');
    expect(cs.summary(3, 4)).toBe('3 generace, 4 osoby');
    expect(cs.summary(1, 1)).toBe('1 generace, 1 osoba');
  });
});
