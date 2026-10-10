/**
 * Small tree builders used by the unit tests and for tuning the layout.
 * Nothing here is used by the app itself.
 */
import { ChildRelation, DEFAULT_VIEW, Family, Person, Sex, TreeDocument } from '../model/types';

export class DocBuilder {
  readonly people: Person[] = [];
  readonly families: Family[] = [];

  person(id: string, given: string, surname = '', sex: Sex = 'unknown', born?: string): string {
    const p: Person = { id, sex, name: { given, surname } };
    if (born) p.birth = { date: { value: born } };
    this.people.push(p);
    return id;
  }

  family(id: string, partners: string[], children: (string | [string, ChildRelation])[] = [], extra: Partial<Family> = {}): string {
    this.families.push({
      id,
      kind: 'marriage',
      partners,
      children: children.map((c) => (typeof c === 'string' ? { personId: c, relation: 'biological' } : { personId: c[0], relation: c[1] })),
      ...extra,
    });
    return id;
  }

  build(title = 'Test tree'): TreeDocument {
    return {
      meta: { title },
      view: { ...DEFAULT_VIEW },
      people: this.people,
      families: this.families,
    };
  }
}

export function nuclearFamily(): TreeDocument {
  const b = new DocBuilder();
  b.person('I1', 'Father', 'Smith', 'male');
  b.person('I2', 'Mother', 'Smith', 'female');
  b.person('I3', 'Anna', 'Smith', 'female', '1990');
  b.person('I4', 'Ben', 'Smith', 'male', '1992');
  b.family('F1', ['I1', 'I2'], ['I3', 'I4']);
  return b.build('Nuclear family');
}

/** One man with three wives in turn and children from each marriage. */
export function threeSpouses(): TreeDocument {
  const b = new DocBuilder();
  b.person('P', 'Paul', 'Reed', 'male');
  b.person('S1', 'Sara', 'Lane', 'female');
  b.person('S2', 'Tess', 'Hart', 'female');
  b.person('S3', 'Uma', 'Ford', 'female');
  b.person('PF', 'Peter', 'Reed', 'male');
  b.person('PM', 'Pam', 'Reed', 'female');
  b.person('TF', 'Tom', 'Hart', 'male');
  b.person('TM', 'Tina', 'Hart', 'female');
  for (const k of ['A', 'B', 'C', 'D', 'E', 'F']) b.person(k, `Child ${k}`, 'Reed');
  b.family('F0', ['PF', 'PM'], ['P']);
  b.family('F00', ['TF', 'TM'], ['S2']);
  b.family('F1', ['P', 'S1'], ['A', 'B'], { start: { date: { value: '1960' } } });
  b.family('F2', ['P', 'S2'], ['C', 'D'], { start: { date: { value: '1970' } } });
  b.family('F3', ['P', 'S3'], ['E', 'F'], { start: { date: { value: '1980' } } });
  return b.build('Three spouses');
}

/** A man marries his niece: partners from different generations. */
export function crossGeneration(): TreeDocument {
  const b = new DocBuilder();
  b.person('G1', 'Grandpa', 'Vale', 'male');
  b.person('G2', 'Grandma', 'Vale', 'female');
  b.person('A', 'Alan', 'Vale', 'male');
  b.person('X', 'Xena', 'Vale', 'female');
  b.person('Y', 'Yuri', 'Ost', 'male');
  b.person('B', 'Bea', 'Ost', 'female');
  b.person('C', 'Cara', 'Vale', 'female');
  b.family('F1', ['G1', 'G2'], ['A', 'X']);
  b.family('F2', ['Y', 'X'], ['B']);
  b.family('F3', ['A', 'B'], ['C']);
  return b.build('Cross-generation marriage');
}

/** First cousins marry (pedigree collapse). */
export function cousinMarriage(): TreeDocument {
  const b = new DocBuilder();
  b.person('GF', 'George', 'Hale', 'male');
  b.person('GM', 'Grace', 'Hale', 'female');
  b.person('S1', 'Sam', 'Hale', 'male');
  b.person('S2', 'Sue', 'Hale', 'female');
  b.person('W1', 'Wendy', 'Oak', 'female');
  b.person('W2', 'Walt', 'Pine', 'male');
  b.person('C1', 'Carl', 'Hale', 'male');
  b.person('C2', 'Cleo', 'Pine', 'female');
  b.person('D', 'Dora', 'Hale', 'female');
  b.family('F1', ['GF', 'GM'], ['S1', 'S2']);
  b.family('F2', ['S1', 'W1'], ['C1']);
  b.family('F3', ['W2', 'S2'], ['C2']);
  b.family('F4', ['C1', 'C2'], ['D']);
  return b.build('Cousin marriage');
}

/** Two unrelated families and a person on their own. */
export function disconnected(): TreeDocument {
  const b = new DocBuilder();
  b.person('A1', 'Amos', 'North', 'male');
  b.person('A2', 'Alma', 'North', 'female');
  b.person('A3', 'Abel', 'North', 'male');
  b.family('FA', ['A1', 'A2'], ['A3']);
  b.person('B1', 'Bruno', 'South', 'male');
  b.person('B2', 'Bella', 'South', 'female');
  b.family('FB', ['B1', 'B2']);
  b.person('L', 'Lone', 'Wolf', 'unknown');
  return b.build('Disconnected');
}

/** A child with known birth parents who was adopted by another couple. */
export function adoptionBothFamilies(): TreeDocument {
  const b = new DocBuilder();
  b.person('BF', 'Birth', 'Father', 'male');
  b.person('BM', 'Birth', 'Mother', 'female');
  b.person('AF', 'Adoptive', 'Father', 'male');
  b.person('AM', 'Adoptive', 'Mother', 'female');
  b.person('K', 'Kid', 'Adopted', 'female');
  b.person('Z', 'Zack', 'Adoptive', 'male');
  b.family('FB', ['BF', 'BM'], ['K']);
  b.family('FA', ['AF', 'AM'], [['K', 'adopted'], 'Z']);
  return b.build('Adoption with birth parents');
}

/** A couple with many married children whose in-laws' parents are recorded too. */
export function wideFamily(children = 7): TreeDocument {
  const b = new DocBuilder();
  b.person('F', 'Frank', 'Wide', 'male');
  b.person('M', 'Mary', 'Wide', 'female');
  const kids: string[] = [];
  for (let i = 0; i < children; i++) {
    const kid = b.person(`K${i}`, `Kid${i}`, 'Wide', i % 2 ? 'female' : 'male', String(1950 + i));
    kids.push(kid);
    const spouse = b.person(`S${i}`, `Spouse${i}`, `Law${i}`, i % 2 ? 'male' : 'female');
    if (i % 2 === 0) {
      b.person(`SF${i}`, `InlawDad${i}`, `Law${i}`, 'male');
      b.person(`SM${i}`, `InlawMum${i}`, `Law${i}`, 'female');
      b.family(`FS${i}`, [`SF${i}`, `SM${i}`], [spouse]);
    }
    const g1 = b.person(`G${i}a`, `Grand${i}a`, 'Wide');
    const g2 = b.person(`G${i}b`, `Grand${i}b`, 'Wide');
    b.family(`FK${i}`, [kid, spouse], [g1, g2]);
  }
  b.family('F0', ['F', 'M'], kids);
  return b.build('Wide family');
}

/** Full ancestry of one person over `depth` generations. */
export function pedigree(depth = 5): TreeDocument {
  const b = new DocBuilder();
  let counter = 0;
  const add = (level: number): string => {
    const id = `P${counter++}`;
    b.person(id, `Gen${level}`, `N${id}`, level === 0 ? 'unknown' : counter % 2 ? 'male' : 'female');
    if (level < depth - 1) {
      const father = add(level + 1);
      const mother = add(level + 1);
      b.family(`F${id}`, [father, mother], [id]);
    }
    return id;
  };
  add(0);
  return b.build(`Pedigree of ${depth} generations`);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random but realistic connected family, for robustness tests. */
export function randomFamily(seed: number, size: number): TreeDocument {
  const rand = mulberry32(seed);
  const b = new DocBuilder();
  let n = 0;
  let f = 0;
  const newPerson = (sex: Sex) => b.person(`R${n++}`, `P${n}`, `S${Math.floor(rand() * 6)}`, sex);
  const partnerOf = new Map<string, string[]>();
  const hasParents = new Set<string>();
  const familyOf = new Map<string, Family>();
  const coupleKey = (a: string, c: string) => [a, c].sort().join('+');

  const root = newPerson('male');
  const rootWife = newPerson('female');
  b.family(`RF${f++}`, [root, rootWife]);
  familyOf.set(coupleKey(root, rootWife), b.families[b.families.length - 1]);
  partnerOf.set(root, [rootWife]);
  partnerOf.set(rootWife, [root]);

  while (b.people.length < size) {
    const person = b.people[Math.floor(rand() * b.people.length)].id;
    const roll = rand();
    if (roll < 0.55) {
      // child with an existing partner, or a new partner
      let partners = partnerOf.get(person) ?? [];
      if (!partners.length || rand() < 0.1) {
        const spouse = newPerson(rand() < 0.5 ? 'male' : 'female');
        partners = [...partners, spouse];
        partnerOf.set(person, partners);
        partnerOf.set(spouse, [person]);
        b.family(`RF${f++}`, [person, spouse]);
        familyOf.set(coupleKey(person, spouse), b.families[b.families.length - 1]);
      }
      const other = partners[Math.floor(rand() * partners.length)];
      const fam = familyOf.get(coupleKey(person, other))!;
      const child = newPerson(rand() < 0.5 ? 'male' : 'female');
      fam.children.push({ personId: child, relation: rand() < 0.05 ? 'adopted' : 'biological' });
      hasParents.add(child);
    } else if (roll < 0.75 && !hasParents.has(person)) {
      const dad = newPerson('male');
      const mum = newPerson('female');
      b.family(`RF${f++}`, [dad, mum], [person]);
      familyOf.set(coupleKey(dad, mum), b.families[b.families.length - 1]);
      partnerOf.set(dad, [mum]);
      partnerOf.set(mum, [dad]);
      hasParents.add(person);
    }
  }
  return b.build(`Random family ${seed}`);
}
