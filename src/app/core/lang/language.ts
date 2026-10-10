/**
 * Words drawn on the chart and in prints: relationship names, marriage notes,
 * lifespans and page captions. This is the language of the tree itself, chosen
 * per tree; the app's interface has its own translations (src/app/i18n), which
 * borrow the dates from here.
 *
 * To add a language, write a pack like en.ts and add it to LANGUAGES below.
 */
import { Kin } from '../kinship/kinship';
import { RelationshipStatus } from '../model/relationship';
import { SurnameForm } from '../model/surnames';
import { Family, GenDate, Person, Sex } from '../model/types';
import { capitalize } from './common';
import { czech } from './cs';
import { english } from './en';

export { capitalize, yearSpan } from './common';

export interface ChartLanguage {
  /** BCP 47 tag, e.g. "en". */
  code: string;
  /** The language's name in itself, for the language switch. */
  name: string;
  /** How someone is related, in lower case: "mother", "wife's cousin". */
  kin(kin: Kin, sex: Sex): string;
  /** A short note for the line between partners: "m. 1952, Lyon", "div. 1988". */
  union(family: Family, status: RelationshipStatus): string;
  /** "1898 – 1971", "b. 1993", "† 1971". */
  lifespan(person: Pick<Person, 'birth' | 'death'>): string;
  /** "c. 1923", "1923". */
  shortDate(date: GenDate | undefined): string;
  /** "17 May 1923", "about May 1923", or the date as written when it is not a calendar date. */
  fullDate(date: GenDate | undefined): string;
  /** "10 October 2026". */
  longDate(date: Date): string;
  /** "Ashworth née Barlow". */
  maidenName(surname: string, birthSurname: string, sex: Sex): string;
  /** A surname in the form for someone's sex: Novák and Nováková in Czech, unchanged in English. */
  surnameFor: SurnameForm;
  /** Shown instead of a missing given name. */
  unnamed: string;
  /** "Five generations, 29 people". */
  summary(generations: number, people: number): string;
  /** "Drawn 10 October 2026". */
  drawn(date: Date): string;
  /** "Generation". */
  generation: string;
  /** "Family tree", as a caption. */
  familyTree: string;
  /** Legend entry for names that appear only once. */
  others: string;
  /** Legend entries when the colours show sex: "Women", "Men". */
  sexes: Record<Sex, string>;
  /** A sibling born together with someone, in lower case: "twin sister", "triplet brother". `count` is how many were born. */
  bornWith(sex: Sex, count: number): string;
}

export const LANGUAGES: readonly ChartLanguage[] = [english, czech];

/** The pack for a language tag; "cs-CZ" finds "cs". Unknown languages get English. */
export function chartLanguage(code: string | undefined): ChartLanguage {
  const tag = (code ?? 'en').toLowerCase();
  return LANGUAGES.find((l) => l.code === tag) ?? LANGUAGES.find((l) => l.code === tag.split('-')[0]) ?? english;
}

/**
 * Display form of a relationship: capitalised, or empty for the person
 * themselves. `bornWith` is how many were born together when this person is
 * a twin (triplet…) of the person in the middle.
 */
export function kinLabel(language: ChartLanguage, kin: Kin | undefined, sex: Sex, bornWith = 0): string {
  if (!kin || kin.kind === 'self') return '';
  return capitalize(bornWith > 1 ? language.bornWith(sex, bornWith) : language.kin(kin, sex));
}

/**
 * "Ashworth née Barlow" in the tree's language, or just the surname. `birth`
 * is the surname at birth when it is known from elsewhere (the father's).
 */
export function surnameLineIn(language: ChartLanguage, person: Person, birth = person.name.birthSurname?.trim() ?? ''): string {
  const surname = person.name.surname.trim();
  if (birth && birth !== surname) return surname ? language.maidenName(surname, birth, person.sex) : birth;
  return surname;
}
