/**
 * The people list grouped by family name: the forms of one name go together
 * (Mikula and Mikulová, Černý and Černá), each family's members oldest first.
 */
import { dateYear } from '../../../../core/model/dates';
import { surnameKey } from '../../../../core/model/names';
import { Person } from '../../../../core/model/types';

export interface FamilyGroup {
  /** The family's key (see surnameKey); empty for people with no surname. */
  key: string;
  /** The spellings in the family, the masculine or base form first: ["Mikula", "Mikulová"]. */
  spellings: string[];
  members: Person[];
}

const FEMININE = /(?:ová|á|ska|cka|ova|eva|ina)$/i;

/** Groups people by the surname they have now (or had at birth, when no other is known). */
export function groupByFamily(people: readonly Person[], compare: (a: string, b: string) => number): FamilyGroup[] {
  const groups = new Map<string, { spellings: Map<string, number>; members: Person[] }>();
  for (const p of people) {
    const surname = p.name.surname.trim() || p.name.birthSurname?.trim() || '';
    const key = surnameKey(surname);
    const g = groups.get(key) ?? { spellings: new Map<string, number>(), members: [] };
    if (surname) g.spellings.set(surname, (g.spellings.get(surname) ?? 0) + 1);
    g.members.push(p);
    groups.set(key, g);
  }
  const byBirth = (a: Person, b: Person) =>
    (dateYear(a.birth?.date) ?? Infinity) - (dateYear(b.birth?.date) ?? Infinity) || compare(a.name.given, b.name.given);
  const out = [...groups.entries()].map(([key, g]) => ({
    key,
    spellings: [...g.spellings.keys()].sort(
      (a, b) => Number(FEMININE.test(a)) - Number(FEMININE.test(b)) || g.spellings.get(b)! - g.spellings.get(a)! || a.length - b.length,
    ),
    members: g.members.sort(byBirth),
  }));
  // Families by name; people with no surname last.
  return out.sort((a, b) => Number(!a.key) - Number(!b.key) || compare(a.spellings[0] ?? '', b.spellings[0] ?? ''));
}
