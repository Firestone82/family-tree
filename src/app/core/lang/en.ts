import type { Kin } from '../kinship/kinship';
import type { RelationshipStatus } from '../model/relationship';
import { SAME_SURNAME } from '../model/surnames';
import type { DateQualifier, Family, GenDate, Person, Sex } from '../model/types';
import { bySex, capitalize, fullDateWith, lifespanWith, shortDateWith } from './common';
import type { ChartLanguage } from './language';

const QUALIFIERS: Record<DateQualifier, string> = {
  about: 'c.',
  before: 'bef.',
  after: 'aft.',
  estimated: 'est.',
  calculated: 'calc.',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const NUMBERS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}

function nth(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "great-", "great-great-", "3rd great-". */
function greats(n: number): string {
  if (n <= 0) return '';
  if (n === 1) return 'great-';
  if (n === 2) return 'great-great-';
  return `${nth(n)} great-`;
}

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

function ancestor(up: number, sex: Sex): string {
  if (up === 1) return bySex(sex, 'father', 'mother', 'parent');
  return greats(up - 2) + bySex(sex, 'grandfather', 'grandmother', 'grandparent');
}

function descendant(down: number, sex: Sex): string {
  if (down === 1) return bySex(sex, 'son', 'daughter', 'child');
  return greats(down - 2) + bySex(sex, 'grandson', 'granddaughter', 'grandchild');
}

function line(kin: Kin & { kind: 'line' }, sex: Sex): string {
  const { up, down } = kin;
  if (down === 0) {
    const base = ancestor(up, sex);
    if (up === 1 && kin.via === 'adopted') return `adoptive ${base}`;
    if (up === 1 && kin.via === 'foster') return `foster ${base}`;
    if (up === 1 && kin.birth) return `birth ${base}`;
    return base;
  }
  if (up === 0) {
    const base = descendant(down, sex);
    if (down === 1 && kin.via === 'adopted') return `adopted ${base}`;
    if (down === 1 && kin.via === 'foster') return `foster ${base}`;
    return base;
  }
  if (up === 1 && down === 1) {
    const base = bySex(sex, 'brother', 'sister', 'sibling');
    return kin.half ? `half-${base}` : base;
  }
  if (down === 1) return greats(up - 2) + bySex(sex, 'uncle', 'aunt', 'aunt or uncle');
  if (up === 1) return greats(down - 2) + bySex(sex, 'nephew', 'niece', 'niece or nephew');
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  if (!removed) return degree === 1 ? 'cousin' : `${ordinal(degree)} cousin`;
  return `${ordinal(degree)} cousin ${times(removed)} removed`;
}

function partner(kin: Kin & { kind: 'partner' }, sex: Sex): string {
  const spouse = bySex(sex, 'husband', 'wife', 'spouse');
  switch (kin.status) {
    case 'married':
    case 'widowed':
      return kin.late ? `late ${spouse}` : spouse;
    case 'engaged':
      return bySex(sex, 'fiancé', 'fiancée', 'fiancé(e)');
    case 'separated':
      return kin.married ? `separated ${spouse}` : 'ex-partner';
    case 'divorced':
    case 'annulled':
      return `ex-${spouse}`;
    case 'ended':
      return kin.married ? `ex-${spouse}` : 'ex-partner';
    case 'partners':
    case 'unknown':
      return 'partner';
  }
}

const STEP = {
  parent: ['stepfather', 'stepmother', 'step-parent'],
  child: ['stepson', 'stepdaughter', 'stepchild'],
  sibling: ['stepbrother', 'stepsister', 'step-sibling'],
  grandparent: ['step-grandfather', 'step-grandmother', 'step-grandparent'],
  grandchild: ['step-grandson', 'step-granddaughter', 'step-grandchild'],
} as const;

const IN_LAW = {
  parent: ['father-in-law', 'mother-in-law', 'parent-in-law'],
  child: ['son-in-law', 'daughter-in-law', 'child-in-law'],
  sibling: ['brother-in-law', 'sister-in-law', 'sibling-in-law'],
  grandparent: ['grandfather-in-law', 'grandmother-in-law', 'grandparent-in-law'],
  grandchild: ['grandson-in-law', 'granddaughter-in-law', 'grandchild-in-law'],
} as const;

function kin(k: Kin, sex: Sex): string {
  switch (k.kind) {
    case 'self':
      return '';
    case 'line':
      return line(k, sex);
    case 'partner':
      return partner(k, sex);
    case 'step': {
      const [m, f, n] = STEP[k.rel];
      return bySex(sex, m, f, n);
    }
    case 'inlaw': {
      const [m, f, n] = IN_LAW[k.rel];
      return bySex(sex, m, f, n);
    }
    case 'via':
      return `${kin(k.first, k.firstSex)}’s ${kin(k.second, sex)}`;
  }
}

function shortDate(date: GenDate | undefined): string {
  return shortDateWith(date, QUALIFIERS);
}

function union(f: Family, status: RelationshipStatus): string {
  const start = shortDate(f.start?.date);
  const place = f.start?.place?.trim() ?? '';
  const end = shortDate(f.end?.date);
  const married = (withPlace: boolean) => {
    if (start && place && withPlace) return `m. ${start}, ${place}`;
    if (start) return `m. ${start}`;
    if (place && withPlace) return `m. in ${place}`;
    return '';
  };
  switch (status) {
    case 'married':
    case 'widowed':
      return married(true);
    case 'engaged': {
      const when = shortDate(f.engagement?.date);
      return when ? `engaged ${when}` : 'engaged';
    }
    case 'partners':
      return start ? `together since ${start}` : '';
    case 'divorced':
      return [married(false), end ? `div. ${end}` : 'divorced'].filter(Boolean).join(', ');
    case 'separated':
      return [f.kind === 'marriage' ? married(false) : start ? `since ${start}` : '', end ? `sep. ${end}` : 'separated'].filter(Boolean).join(', ');
    case 'annulled':
      return end ? `annulled ${end}` : 'annulled';
    case 'ended':
      return start && end ? `${start}–${end}` : end ? `until ${end}` : '';
    case 'unknown':
      return '';
  }
}

function longDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const QUALIFIERS_LONG: Record<DateQualifier, string> = { about: 'about', before: 'before', after: 'after', estimated: 'estimated', calculated: 'calculated' };

function fullDate(date: GenDate | undefined): string {
  return fullDateWith(date, QUALIFIERS_LONG, (y, m, d) => (m && d ? `${d} ${MONTHS[m - 1]} ${y}` : m ? `${MONTHS[m - 1]} ${y}` : String(y)));
}

export const english: ChartLanguage = {
  code: 'en',
  name: 'English',
  kin,
  union,
  lifespan: (p: Pick<Person, 'birth' | 'death'>) => lifespanWith(p, shortDate, 'b.'),
  shortDate,
  fullDate,
  longDate,
  maidenName: (surname, birth, sex) => `${surname} ${sex === 'male' ? 'né' : 'née'} ${birth}`,
  surnameFor: SAME_SURNAME,
  unnamed: 'Unnamed',
  summary(generations, people) {
    const g = generations === 1 ? 'One generation' : `${NUMBERS[generations] ?? generations} generations`;
    const p = people === 1 ? '1 person' : `${people} people`;
    return capitalize(`${g}, ${p}`);
  },
  drawn: (date) => `Drawn ${longDate(date)}`,
  generation: 'Generation',
  familyTree: 'Family tree',
  others: 'Other names',
  sexes: { female: 'Women', male: 'Men', other: 'Other', unknown: 'Not recorded' },
  bornWith: (sex, count) => {
    const word = ['', '', 'twin', 'triplet', 'quadruplet', 'quintuplet', 'sextuplet'][count];
    if (!word) return bySex(sex, 'brother', 'sister', 'sibling');
    return bySex(sex, `${word} brother`, `${word} sister`, word);
  },
};
