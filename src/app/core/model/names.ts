import { Person } from './types';

export function givenOrPlaceholder(person: Person): string {
  return person.name.given.trim() || 'Unnamed';
}

/** "Anna Marie Hartmann", or "Unnamed person" when nothing is filled in. */
export function displayName(person: Person | undefined): string {
  if (!person) return 'Unknown person';
  const given = person.name.given.trim();
  const surname = person.name.surname.trim();
  const full = [given, surname].filter(Boolean).join(' ');
  return full || 'Unnamed person';
}

/** Surname line with the birth surname when it differs: "Ashworth née Moreau". */
export function surnameLine(person: Person): string {
  const surname = person.name.surname.trim();
  const birth = person.name.birthSurname?.trim();
  if (birth && birth !== surname) return surname ? `${surname} née ${birth}` : birth;
  return surname;
}

/** "Hartmann, Anna Marie" for alphabetical lists. */
export function sortName(person: Person): string {
  const given = person.name.given.trim();
  const surname = person.name.surname.trim();
  if (surname && given) return `${surname}, ${given}`;
  return surname || given || 'Unnamed person';
}

let graphemes: Intl.Segmenter | null | undefined;

function firstLetter(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (graphemes === undefined) {
    graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  // The first user-perceived character, so "Šárka" gives "Š" even when decomposed.
  const first = graphemes ? (graphemes.segment(trimmed)[Symbol.iterator]().next().value?.segment ?? '') : Array.from(trimmed)[0];
  return first.toLocaleUpperCase();
}

/** One or two letters for the chart badge. */
export function initials(person: Person): string {
  const given = firstLetter(person.name.given);
  const surname = firstLetter(person.name.surname || person.name.birthSurname || '');
  return given + surname || '?';
}

function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC');
}

/**
 * Groups spellings of one family name under a single key, so the chart can colour
 * a family consistently. Folds case, diacritics and the common feminine forms of
 * Central and Eastern European surnames (Novák/Nováková, Svoboda/Svobodová,
 * Marek/Marková, Černý/Černá, Kowalski/Kowalska, Ivanov/Ivanova).
 */
export function surnameKey(raw: string | undefined): string {
  const text = (raw ?? '').trim().toLocaleLowerCase().normalize('NFC');
  if (!text) return '';
  const words = text.split(/\s+/);
  let last = words[words.length - 1];
  if (last.length > 4 && last.endsWith('ová')) last = last.slice(0, -3);
  else if (/(?:sk|ck|dzk)[ia]$/.test(last)) last = last.slice(0, -1);
  else if (last.length > 3 && /[áý]$/.test(last)) last = last.slice(0, -1);
  else if (last.length > 3 && last.endsWith('a')) last = last.slice(0, -1);
  // The movable e of Czech names: Marek and Marková, Němec and Němcová, Havel and Havlová.
  last = last.replace(/([^aáeéěiíoóuúůyý])[eě]([kcl])$/, '$1$2');
  words[words.length - 1] = last;
  return stripDiacritics(words.join(' '));
}

/** The surname a person was born with, which decides their family colour. */
export function lineageSurname(person: Person): string {
  return person.name.birthSurname?.trim() || person.name.surname.trim();
}

export function searchText(person: Person): string {
  const parts = [person.name.given, person.name.surname, person.name.birthSurname ?? '', person.name.nickname ?? ''];
  return stripDiacritics(parts.join(' ').toLocaleLowerCase());
}

export function normalizeQuery(query: string): string {
  return stripDiacritics(query.trim().toLocaleLowerCase());
}
