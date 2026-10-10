/**
 * Colours for the chart, named after heraldic tinctures: each family name gets
 * its own colour on the small shield beside the name, the way a family once
 * had its arms. The actual colour values live in the chart styles, per theme.
 */
import { lineageSurname, surnameKey } from '../model/names';
import { ColorBy, Person, Sex, TreeDocument } from '../model/types';
import { toRoman } from '../layout/layout-types';

export type Tincture = 'azure' | 'gules' | 'vert' | 'purpure' | 'or' | 'tenne' | 'sanguine' | 'celeste' | 'sable' | 'argent';

/** Colours handed out to families, most numerous family first. */
export const LINE_TINCTURES: readonly Tincture[] = ['azure', 'gules', 'vert', 'purpure', 'or', 'tenne', 'sanguine', 'celeste', 'sable'];

export interface LegendEntry {
  key: string;
  label: string;
  tincture: Tincture;
  count: number;
}

export interface ColorAssignment {
  byPerson: ReadonlyMap<string, Tincture>;
  legend: LegendEntry[];
}

const SEX_TINCTURE: Record<Sex, Tincture> = { male: 'azure', female: 'sanguine', other: 'vert', unknown: 'argent' };

/**
 * Colours for everyone in the tree. `lineage` gives the surname a person was
 * born with, which picks their family colour; by default the recorded one.
 * `ranks` gives each person's generation row; people without one are not on
 * the chart and are left out of the generations. When `doc` is part of a
 * bigger tree (a print of some of it), `whole` is the tree: families keep the
 * colours they have on the chart, and the legend counts the people in `doc`.
 */
export function assignColors(
  doc: TreeDocument,
  colorBy: ColorBy,
  ranks: ReadonlyMap<string, number>,
  lineage: (p: Person) => string = lineageSurname,
  whole: TreeDocument = doc,
): ColorAssignment {
  const byPerson = new Map<string, Tincture>();
  switch (colorBy) {
    case 'family':
      return byFamily(doc, whole, lineage);
    case 'generation': {
      // Number the rows that hold people, so the first generation gets the first colour.
      const used = new Map<number, number>();
      for (const p of doc.people) {
        const r = ranks.get(p.id);
        if (r !== undefined) used.set(r, (used.get(r) ?? 0) + 1);
      }
      const rows = [...used.keys()].sort((a, b) => a - b);
      const generation = new Map(rows.map((r, i) => [r, i]));
      for (const p of doc.people) {
        const r = ranks.get(p.id);
        const g = r === undefined ? undefined : generation.get(r);
        byPerson.set(p.id, g === undefined ? 'argent' : LINE_TINCTURES[g % LINE_TINCTURES.length]);
      }
      // Labelled with the generation's numeral; the interface and prints add the word for it.
      const legend = rows.map((r, i) => ({ key: String(r), label: toRoman(i + 1), tincture: LINE_TINCTURES[i % LINE_TINCTURES.length], count: used.get(r)! }));
      return { byPerson, legend };
    }
    case 'sex': {
      const counts = new Map<Sex, number>();
      for (const p of doc.people) {
        byPerson.set(p.id, SEX_TINCTURE[p.sex]);
        counts.set(p.sex, (counts.get(p.sex) ?? 0) + 1);
      }
      const order: Sex[] = ['female', 'male', 'other', 'unknown'];
      // Keyed by sex; the interface and prints put it in words.
      const legend = order.filter((s) => counts.has(s)).map((s) => ({ key: s, label: s, tincture: SEX_TINCTURE[s], count: counts.get(s)! }));
      return { byPerson, legend };
    }
    case 'none':
      for (const p of doc.people) byPerson.set(p.id, 'argent');
      return { byPerson, legend: [] };
  }
}

function byFamily(doc: TreeDocument, whole: TreeDocument, lineage: (p: Person) => string): ColorAssignment {
  // Colours go to the families of the whole tree, most numerous first.
  const ranked = familyGroups(whole.people, lineage)
    .filter(([, g]) => g.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
  const tinctureOf = new Map(ranked.map(([key], i) => [key, LINE_TINCTURES[i % LINE_TINCTURES.length]]));
  const byPerson = new Map<string, Tincture>();
  let others = 0;
  for (const p of doc.people) {
    const t = tinctureOf.get(surnameKey(lineage(p)));
    byPerson.set(p.id, t ?? 'argent');
    if (!t) others++;
  }
  // The legend counts the people in this part of the tree, in the order the colours were given.
  const here = new Map(familyGroups(doc.people, lineage));
  const legend: LegendEntry[] = [];
  for (const [key] of ranked) {
    const g = here.get(key);
    if (g) legend.push({ key, label: preferredSpelling(g.spellings), tincture: tinctureOf.get(key)!, count: g.count });
  }
  if (others) legend.push({ key: '', label: 'Others', tincture: 'argent', count: others });
  return { byPerson, legend };
}

interface FamilyGroup {
  count: number;
  first: number;
  spellings: Map<string, number>;
}

/** People by the family they were born into (Novák and Nováková together), with how each spells it. */
function familyGroups(people: readonly Person[], lineage: (p: Person) => string): [string, FamilyGroup][] {
  const groups = new Map<string, FamilyGroup>();
  people.forEach((p, i) => {
    const raw = lineage(p);
    const key = surnameKey(raw);
    if (!key) return;
    const g = groups.get(key) ?? { count: 0, first: i, spellings: new Map<string, number>() };
    g.count++;
    g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
    groups.set(key, g);
  });
  return [...groups.entries()];
}

/** The most used spelling; on a tie the shortest, which is usually the base form (Novák, not Nováková). */
function preferredSpelling(spellings: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [s, c] of spellings) {
    if (c > bestCount || (c === bestCount && s.length < best.length)) {
      best = s;
      bestCount = c;
    }
  }
  return best;
}
