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
 */
export function assignColors(
  doc: TreeDocument,
  colorBy: ColorBy,
  ranks: ReadonlyMap<string, number>,
  lineage: (p: Person) => string = lineageSurname,
): ColorAssignment {
  const byPerson = new Map<string, Tincture>();
  switch (colorBy) {
    case 'family':
      return byFamily(doc, lineage);
    case 'generation': {
      // Number the rows that hold people, so the first generation gets the first colour.
      const used = new Map<number, number>();
      for (const p of doc.people) {
        const r = ranks.get(p.id) ?? 0;
        used.set(r, (used.get(r) ?? 0) + 1);
      }
      const rows = [...used.keys()].sort((a, b) => a - b);
      const generation = new Map(rows.map((r, i) => [r, i]));
      for (const p of doc.people) {
        const g = generation.get(ranks.get(p.id) ?? 0) ?? 0;
        byPerson.set(p.id, LINE_TINCTURES[g % LINE_TINCTURES.length]);
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

function byFamily(doc: TreeDocument, lineage: (p: Person) => string): ColorAssignment {
  const groups = new Map<string, { count: number; first: number; spellings: Map<string, number> }>();
  const lineageOf = new Map(doc.people.map((p) => [p.id, lineage(p)]));
  doc.people.forEach((p, i) => {
    const raw = lineageOf.get(p.id)!;
    const key = surnameKey(raw);
    if (!key) return;
    const g = groups.get(key) ?? { count: 0, first: i, spellings: new Map<string, number>() };
    g.count++;
    g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1);
    groups.set(key, g);
  });
  const ranked = [...groups.entries()].filter(([, g]) => g.count >= 2).sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
  const tinctureOf = new Map(ranked.map(([key], i) => [key, LINE_TINCTURES[i % LINE_TINCTURES.length]]));
  const byPerson = new Map<string, Tincture>();
  let others = 0;
  for (const p of doc.people) {
    const t = tinctureOf.get(surnameKey(lineageOf.get(p.id)));
    byPerson.set(p.id, t ?? 'argent');
    if (!t) others++;
  }
  const legend: LegendEntry[] = ranked.map(([key, g]) => ({ key, label: preferredSpelling(g.spellings), tincture: tinctureOf.get(key)!, count: g.count }));
  if (others) legend.push({ key: '', label: 'Others', tincture: 'argent', count: others });
  return { byPerson, legend };
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
