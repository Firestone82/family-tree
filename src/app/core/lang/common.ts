/** Helpers shared by the language packs. */
import { DateQualifier, GenDate, Person } from '../model/types';

export const THIN_SPACE = ' ';
export const EN_DASH = '–';

const ISO_PARTIAL = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function capitalize(text: string): string {
  if (!text) return text;
  const first = Array.from(text)[0];
  return first.toLocaleUpperCase() + text.slice(first.length);
}

export function yearSpan(from: number, to: number): string {
  return from === to ? String(from) : `${from}${THIN_SPACE}${EN_DASH}${THIN_SPACE}${to}`;
}

/** The year of a date with its qualifier abbreviated, or the free text. */
export function shortDateWith(date: GenDate | undefined, qualifiers: Record<DateQualifier, string>): string {
  if (!date) return '';
  if (!date.value) return date.text ?? '';
  const m = ISO_PARTIAL.exec(date.value);
  if (!m) return date.value;
  const year = String(Number(m[1]));
  return date.qualifier ? `${qualifiers[date.qualifier]} ${year}` : year;
}

/** "1898 – 1971", or `born`/`died` prefixes when only one end is known. */
export function lifespanWith(person: Pick<Person, 'birth' | 'death'>, short: (d: GenDate | undefined) => string, bornPrefix: string): string {
  const born = short(person.birth?.date);
  const died = short(person.death?.date);
  const deceased = !!person.death;
  const dash = `${THIN_SPACE}${EN_DASH}${THIN_SPACE}`;
  if (born && died) return `${born}${dash}${died}`;
  if (born && deceased) return `${born}${dash}†`;
  if (born) return `${bornPrefix} ${born}`;
  if (died) return `† ${died}`;
  if (deceased) return '†';
  return '';
}

/** Picks a word by sex. */
export function bySex<T>(sex: string, male: T, female: T, neutral: T): T {
  return sex === 'male' ? male : sex === 'female' ? female : neutral;
}

/** A full date from its parts; `day` and `month` are absent for a bare year. */
export function fullDateWith(
  date: GenDate | undefined,
  qualifiers: Record<DateQualifier, string>,
  format: (year: number, month?: number, day?: number) => string,
): string {
  if (!date) return '';
  if (!date.value) return date.text ?? '';
  const m = ISO_PARTIAL.exec(date.value);
  if (!m) return date.value;
  const core = format(Number(m[1]), m[2] ? Number(m[2]) : undefined, m[3] ? Number(m[3]) : undefined);
  return date.qualifier ? `${qualifiers[date.qualifier]} ${core}` : core;
}
