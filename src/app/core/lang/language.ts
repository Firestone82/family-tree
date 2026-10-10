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
import { GenDate, Person, Sex } from '../model/types';
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
  /**
   * A short note under a couple, for a status their marker does not spell out:
   * "engaged", "divorced". Dates and places of a wedding are not shown.
   */
  union(status: RelationshipStatus): string;
  /** "1898 – 1971", "b. 1993", "† 1971". */
  lifespan(person: Pick<Person, 'birth' | 'death'>): string;
  /** "c. 1923", "1923". */
  shortDate(date: GenDate | undefined): string;
  /** "17 May 1923", "about May 1923", or the date as written when it is not a calendar date. */
  fullDate(date: GenDate | undefined): string;
  /** "10 October 2026". */
  longDate(date: Date): string;
  /** The line under a surname that changed: "née Barlow". */
  bornAs(birthSurname: string, sex: Sex): string;
  /** A surname in the form for someone's sex: Novák and Nováková in Czech, unchanged in English. */
  surnameFor: SurnameForm;
  /** Shown instead of a given name nobody knows: "Unknown", "Neznámá". */
  unknown(sex: Sex): string;
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
 * The surname for a card, and the line under it when the surname at birth was
 * different: "Ashworth" and "née Barlow" in the tree's language. `birth` is the
 * surname at birth when it is known from elsewhere (the father's).
 */
export function surnameLinesIn(language: ChartLanguage, person: Person, birth = person.name.birthSurname?.trim() ?? ''): { surname: string; birth: string } {
  const surname = person.name.surname.trim();
  if (!birth || birth === surname) return { surname, birth: '' };
  return surname ? { surname, birth: language.bornAs(birth, person.sex) } : { surname: birth, birth: '' };
}
