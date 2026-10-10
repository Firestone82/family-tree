import type { Kin } from '../kinship/kinship';
import type { RelationshipStatus } from '../model/relationship';
import type { DateQualifier, GenDate, Person, Sex } from '../model/types';
import { fullDateWith, lifespanWith, shortDateWith } from './common';
import { czechSurnameFor } from './cs-surnames';
import type { ChartLanguage } from './language';

/**
 * Czech. Relationship names need the genitive as well ("manželka bratrance",
 * the wife of a cousin), so terms are built as phrases with both forms.
 */

const QUALIFIERS: Record<DateQualifier, string> = {
  about: 'kol.',
  before: 'před',
  after: 'po',
  estimated: 'odh.',
  calculated: 'vyp.',
};

const MONTHS_GENITIVE = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const KNEE = ['', '', 'druhého', 'třetího', 'čtvrtého', 'pátého', 'šestého', 'sedmého', 'osmého'];

type Gender = 'm' | 'f' | 'n';

interface Phrase {
  nom: string;
  gen: string;
}

/** Genitive singular of the nouns used in relationship names. */
const NOUN_GEN: Record<string, string> = {
  otec: 'otce',
  matka: 'matky',
  rodič: 'rodiče',
  dědeček: 'dědečka',
  babička: 'babičky',
  prarodič: 'prarodiče',
  syn: 'syna',
  dcera: 'dcery',
  dítě: 'dítěte',
  vnuk: 'vnuka',
  vnučka: 'vnučky',
  vnouče: 'vnoučete',
  bratr: 'bratra',
  sestra: 'sestry',
  sourozenec: 'sourozence',
  strýc: 'strýce',
  teta: 'tety',
  synovec: 'synovce',
  neteř: 'neteře',
  bratranec: 'bratrance',
  sestřenice: 'sestřenice',
  manžel: 'manžela',
  manželka: 'manželky',
  partner: 'partnera',
  partnerka: 'partnerky',
  snoubenec: 'snoubence',
  snoubenka: 'snoubenky',
  tchán: 'tchána',
  tchyně: 'tchyně',
  zeť: 'zetě',
  snacha: 'snachy',
  švagr: 'švagra',
  švagrová: 'švagrové',
  pěstoun: 'pěstouna',
  pěstounka: 'pěstounky',
};

function noun(word: string): Phrase {
  if (NOUN_GEN[word]) return { nom: word, gen: NOUN_GEN[word] };
  // "pra" prefixes: prababička, praprastrýc.
  const m = /^((?:pra)+)(.+)$/.exec(word);
  if (m && NOUN_GEN[m[2]]) return { nom: word, gen: m[1] + NOUN_GEN[m[2]] };
  return { nom: word, gen: word };
}

function adjective(word: string, gender: Gender): Phrase {
  if (gender === 'f') return { nom: word, gen: word.replace(/á$/, 'é') };
  return { nom: word, gen: word.replace(/ý$/, 'ého').replace(/í$/, 'ího').replace(/é$/, 'ého') };
}

function join(...parts: Phrase[]): Phrase {
  return { nom: parts.map((p) => p.nom).join(' '), gen: parts.map((p) => p.gen).join(' ') };
}

/** A slash pair for unknown sex: "bratranec/sestřenice". */
function either(a: Phrase, b: Phrase): Phrase {
  return { nom: `${a.nom}/${b.nom}`, gen: `${a.gen}/${b.gen}` };
}

function gender(sex: Sex): Gender {
  return sex === 'male' ? 'm' : sex === 'female' ? 'f' : 'n';
}

function pick(sex: Sex, male: string, female: string, neutral: string): Phrase {
  return noun(sex === 'male' ? male : sex === 'female' ? female : neutral);
}

/** An adjective agreeing with the noun chosen by sex ("nevlastní syn", "bývalá manželka"). */
function withAdjective(sex: Sex, adj: { m: string; f: string; n: string }, nounPhrase: Phrase): Phrase {
  const g = gender(sex);
  const neutralNounIsMasculine = g === 'n';
  const word = g === 'f' ? adj.f : neutralNounIsMasculine ? adj.n : adj.m;
  return join(adjective(word, g === 'f' ? 'f' : 'm'), nounPhrase);
}

const pra = (n: number) => 'pra'.repeat(Math.max(0, n));

function ancestor(up: number, sex: Sex): Phrase {
  if (up === 1) return pick(sex, 'otec', 'matka', 'rodič');
  return pick(sex, `${pra(up - 2)}dědeček`, `${pra(up - 2)}babička`, `${pra(up - 2)}prarodič`);
}

function descendant(down: number, sex: Sex): Phrase {
  if (down === 1) return pick(sex, 'syn', 'dcera', 'dítě');
  return pick(sex, `${pra(down - 2)}vnuk`, `${pra(down - 2)}vnučka`, `${pra(down - 2)}vnouče`);
}

function cousin(degree: number, sex: Sex): Phrase {
  const base = sex === 'male' ? noun('bratranec') : sex === 'female' ? noun('sestřenice') : either(noun('bratranec'), noun('sestřenice'));
  if (degree <= 1) return base;
  const knee = KNEE[degree] ?? `${degree}.`;
  const tail = { nom: `z ${knee} kolena`, gen: `z ${knee} kolena` };
  return join(base, tail);
}

function line(k: Kin & { kind: 'line' }, sex: Sex): Phrase {
  const { up, down } = k;
  if (down === 0) {
    if (up === 1 && k.via === 'adopted') return withAdjective(sex, { m: 'adoptivní', f: 'adoptivní', n: 'adoptivní' }, ancestor(1, sex));
    if (up === 1 && k.via === 'foster') return pick(sex, 'pěstoun', 'pěstounka', 'pěstoun');
    if (up === 1 && k.birth) return withAdjective(sex, { m: 'biologický', f: 'biologická', n: 'biologický' }, ancestor(1, sex));
    return ancestor(up, sex);
  }
  if (up === 0) {
    if (down === 1 && k.via === 'adopted') return withAdjective(sex, { m: 'adoptivní', f: 'adoptivní', n: 'adoptivní' }, descendant(1, sex));
    if (down === 1 && k.via === 'foster') {
      const g = gender(sex);
      return join(adjective(g === 'f' ? 'svěřená' : g === 'm' ? 'svěřený' : 'svěřené', g), descendant(1, sex));
    }
    return descendant(down, sex);
  }
  if (up === 1 && down === 1) {
    const base = pick(sex, 'bratr', 'sestra', 'sourozenec');
    return k.half ? withAdjective(sex, { m: 'polorodý', f: 'polorodá', n: 'polorodý' }, base) : base;
  }
  if (down === 1) {
    if (sex !== 'male' && sex !== 'female') return join(noun('sourozenec'), { nom: ancestor(up - 1, 'unknown').gen, gen: ancestor(up - 1, 'unknown').gen });
    return pick(sex, `${pra(up - 2)}strýc`, `${pra(up - 2)}teta`, '');
  }
  if (up === 1) {
    if (sex !== 'male' && sex !== 'female') {
      const child = descendant(down - 1, 'unknown');
      return join(child, { nom: 'sourozence', gen: 'sourozence' });
    }
    return pick(sex, `${pra(down - 2)}synovec`, `${pra(down - 2)}neteř`, '');
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  if (!removed) return cousin(degree, sex);
  const pivot = k.pivotSex ?? 'unknown';
  if (up > down) {
    // A cousin of the focus person's parent or grandparent: "bratranec otce".
    return join(cousin(degree, sex), { nom: ancestor(removed, pivot).gen, gen: ancestor(removed, pivot).gen });
  }
  // A child or grandchild of a cousin: "syn sestřenice".
  const c = cousin(degree, pivot);
  return join(descendant(removed, sex), { nom: c.gen, gen: c.gen });
}

function spouse(sex: Sex): Phrase {
  return pick(sex, 'manžel', 'manželka', 'partner');
}

function partner(k: Kin & { kind: 'partner' }, sex: Sex): Phrase {
  const former = { m: 'bývalý', f: 'bývalá', n: 'bývalý' };
  switch (k.status) {
    case 'married':
    case 'widowed':
      return k.late ? withAdjective(sex, { m: 'zesnulý', f: 'zesnulá', n: 'zesnulý' }, spouse(sex)) : spouse(sex);
    case 'engaged':
      return pick(sex, 'snoubenec', 'snoubenka', 'snoubenec');
    case 'separated':
      return k.married
        ? withAdjective(sex, { m: 'odloučený', f: 'odloučená', n: 'odloučený' }, spouse(sex))
        : withAdjective(sex, former, pick(sex, 'partner', 'partnerka', 'partner'));
    case 'divorced':
    case 'annulled':
      return withAdjective(sex, former, spouse(sex));
    case 'ended':
      return withAdjective(sex, former, k.married ? spouse(sex) : pick(sex, 'partner', 'partnerka', 'partner'));
    case 'partners':
    case 'unknown':
      return pick(sex, 'partner', 'partnerka', 'partner');
  }
}

const STEP_NOUNS = {
  parent: ['otec', 'matka', 'rodič'],
  child: ['syn', 'dcera', 'dítě'],
  sibling: ['bratr', 'sestra', 'sourozenec'],
  grandparent: ['dědeček', 'babička', 'prarodič'],
  grandchild: ['vnuk', 'vnučka', 'vnouče'],
} as const;

function phrase(k: Kin, sex: Sex): Phrase {
  switch (k.kind) {
    case 'self':
      return { nom: '', gen: '' };
    case 'line':
      return line(k, sex);
    case 'partner':
      return partner(k, sex);
    case 'step': {
      const [m, f, n] = STEP_NOUNS[k.rel];
      return withAdjective(sex, { m: 'nevlastní', f: 'nevlastní', n: 'nevlastní' }, pick(sex, m, f, n));
    }
    case 'inlaw': {
      const link = phrase(k.link.kin, k.link.sex);
      switch (k.rel) {
        case 'parent':
          return sex === 'male' || sex === 'female' ? pick(sex, 'tchán', 'tchyně', '') : join(noun('rodič'), { nom: link.gen, gen: link.gen });
        case 'child':
          return sex === 'male' || sex === 'female' ? pick(sex, 'zeť', 'snacha', '') : join(spouse(sex), { nom: link.gen, gen: link.gen });
        case 'sibling':
          return sex === 'male' || sex === 'female' ? pick(sex, 'švagr', 'švagrová', '') : either(noun('švagr'), noun('švagrová'));
        case 'grandparent':
          return join(ancestor(2, sex), { nom: link.gen, gen: link.gen });
        case 'grandchild':
          return join(spouse(sex), { nom: link.gen, gen: link.gen });
      }
      break;
    }
    case 'via': {
      const second = phrase(k.second, sex);
      const first = phrase(k.first, k.firstSex);
      return { nom: `${second.nom} ${first.gen}`, gen: `${second.gen} ${first.gen}` };
    }
  }
  return { nom: '', gen: '' };
}

function shortDate(date: GenDate | undefined): string {
  return shortDateWith(date, QUALIFIERS);
}

const UNION_NOTES: Partial<Record<RelationshipStatus, string>> = {
  engaged: 'zasnoubení',
  divorced: 'rozvedeni',
  separated: 'odloučeni',
  annulled: 'sňatek zrušen',
};

function union(status: RelationshipStatus): string {
  return UNION_NOTES[status] ?? '';
}

function longDate(date: Date): string {
  return `${date.getDate()}. ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

const MONTHS_NOMINATIVE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const QUALIFIERS_LONG: Record<DateQualifier, string> = { about: 'asi', before: 'před', after: 'po', estimated: 'odhadem', calculated: 'vypočteno' };

/** "17. května 1923", "květen 1923", "asi 1900". */
function fullDate(date: GenDate | undefined): string {
  return fullDateWith(date, QUALIFIERS_LONG, (y, m, d) =>
    m && d ? `${d}. ${MONTHS_GENITIVE[m - 1]} ${y}` : m ? `${MONTHS_NOMINATIVE[m - 1]} ${y}` : String(y),
  );
}

/** 1 generace, 2 generace, 5 generací. */
function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

export const czech: ChartLanguage = {
  code: 'cs',
  name: 'Čeština',
  kin: (k, sex) => phrase(k, sex).nom,
  union,
  lifespan: (p: Pick<Person, 'birth' | 'death'>) => lifespanWith(p, shortDate, '*'),
  shortDate,
  fullDate,
  longDate,
  bornAs: (birth) => `roz. ${birth}`,
  surnameFor: czechSurnameFor,
  unknown: (sex) => (sex === 'female' ? 'Neznámá' : 'Neznámý'),
  summary: (generations, people) =>
    `${generations} ${plural(generations, 'generace', 'generace', 'generací')}, ${people} ${plural(people, 'osoba', 'osoby', 'osob')}`,
  drawn: (date) => `Nakresleno ${longDate(date)}`,
  generation: 'Generace',
  familyTree: 'Rodokmen',
  others: 'Ostatní',
  sexes: { female: 'Ženy', male: 'Muži', other: 'Jiné', unknown: 'Neuvedeno' },
  bornWith: (sex, count) => {
    const word = ['', '', 'dvojče', 'trojče', 'čtyřče', 'paterče', 'šesterče'][count];
    if (!word) return sex === 'male' ? 'bratr' : sex === 'female' ? 'sestra' : 'sourozenec';
    return sex === 'male' ? `bratr-${word}` : sex === 'female' ? `sestra-${word}` : word;
  },
};
