/**
 * Where a person's surname at birth comes from when the file does not say:
 * their father's surname, in the form for their sex in the tree's language
 * (in Czech a daughter of Mikula is Mikulová).
 */
import { surnameKey } from './names';
import { TreeIndex } from './tree-index';
import { Person, Sex } from './types';

/**
 * How a language changes a surname with sex. `known` are surnames of men in
 * the tree, to tell which masculine form a feminine one comes from.
 */
export type SurnameForm = (surname: string, sex: Sex, known?: readonly string[]) => string;

/** For languages whose surnames do not change with sex. */
export const SAME_SURNAME: SurnameForm = (surname) => surname.trim();

/** The father of the family a person was born into, when recorded. */
export function birthFather(index: TreeIndex, personId: string): Person | undefined {
  for (const f of index.parentFamilies(personId)) {
    if (index.childRelation(f, personId) !== 'biological') continue;
    for (const id of f.partners) {
      const p = index.person(id);
      if (p?.sex === 'male') return p;
    }
  }
  return undefined;
}

/** A person's surname taken from their father, in the form for their sex; empty when no father is recorded. */
export function surnameFromFather(index: TreeIndex, person: Person, form: SurnameForm, sex: Sex = person.sex): string {
  const father = birthFather(index, person.id);
  const base = father ? father.name.surname.trim() || father.name.birthSurname?.trim() || '' : '';
  return base ? form(base, sex, [base]) : '';
}

/**
 * The surname a person was born with: as recorded, or else their father's.
 * When their own surname is a form of the same name as their father's (a
 * daughter recorded as Grant rather than Grantová), it is their own.
 */
export function birthSurname(index: TreeIndex, person: Person, form: SurnameForm): string {
  const recorded = person.name.birthSurname?.trim();
  if (recorded) return recorded;
  const own = person.name.surname.trim();
  const fromFather = surnameFromFather(index, person, form);
  if (!fromFather) return own;
  return own && surnameKey(own) === surnameKey(fromFather) ? own : fromFather;
}

/** Surnames of the men in the tree, most common first. */
export function maleSurnames(index: TreeIndex): string[] {
  const counts = new Map<string, number>();
  for (const p of index.doc.people) {
    const s = p.sex === 'male' ? p.name.surname.trim() : '';
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}
