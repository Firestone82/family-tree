/**
 * What the add-relative form suggests and allows, worked out from the tree:
 * likely sex and surname, who could be the other parent, and who cannot be
 * linked without making the tree loop.
 */
import { chartLanguage } from '../../../core/lang/language';
import { birthSurname, maleSurnames, surnameFromFather } from '../../../core/model/surnames';
import { TreeIndex } from '../../../core/model/tree-index';
import { ChildRelation, Person, Sex } from '../../../core/model/types';
import { AddRequest } from '../../../state/ui-state';

/** A new parent is probably the other sex of the known one; a new partner the other sex of the person. */
export function defaultSex(index: TreeIndex, req: AddRequest): Sex {
  const me = index.person(req.personId);
  const opposite = (s: Sex | undefined): Sex => (s === 'male' ? 'female' : s === 'female' ? 'male' : 'unknown');
  if (req.relation === 'parent') {
    const known = index.primaryParentFamily(req.personId)?.partners.map((p) => index.person(p)?.sex);
    return known?.length === 1 ? opposite(known[0]) : 'unknown';
  }
  if (req.relation === 'partner') return opposite(me?.sex);
  return 'unknown';
}

/**
 * The surname a new relative most likely has: the father's, passed down the
 * family, in the form for their sex in the given language (a Czech daughter
 * of Mikula is Mikulová). A new mother's or partner's surname is not guessed.
 * The app passes its own language; without one, the tree's saved language is used.
 */
export function defaultSurname(index: TreeIndex, req: AddRequest, sex: Sex, otherParentId: string | null, language = index.doc.view.language): string {
  const me = index.person(req.personId);
  if (!me) return '';
  const form = chartLanguage(language).surnameFor;
  const known = maleSurnames(index);
  const adapt = (surname: string) => (surname ? form(surname, sex, known) : '');
  switch (req.relation) {
    case 'parent':
      return sex === 'male' ? adapt(birthSurname(index, me, form)) : '';
    case 'sibling':
      return surnameFromFather(index, me, form, sex) || adapt(birthSurname(index, me, form));
    case 'child': {
      const other = index.person(otherParentId ?? undefined);
      const father = me.sex === 'male' ? me : other?.sex === 'male' ? other : undefined;
      // With no father recorded, the child has the mother's surname.
      return adapt((father ?? me).name.surname.trim());
    }
    case 'partner':
      return '';
  }
}

/** Partners who could be a new child's other parent, oldest relationship first. */
export function partnerOptions(index: TreeIndex, personId: string): Person[] {
  return index
    .partnerFamilies(personId)
    .filter((f) => f.partners.length === 2)
    .map((f) => index.person(f.partners.find((p) => p !== personId)))
    .filter((p): p is Person => !!p);
}

/** For a new parent: the other children who would share them, and whether that is optional. */
export function sharedSiblings(index: TreeIndex, req: AddRequest): { people: Person[]; optional: boolean } | null {
  if (req.relation !== 'parent') return null;
  const fam = index.primaryParentFamily(req.personId);
  if (!fam || fam.partners.length >= 2) return null;
  const people = fam.children.map((c) => index.person(c.personId)).filter((p): p is Person => !!p && p.id !== req.personId);
  return people.length ? { people, optional: fam.partners.length === 1 } : null;
}

/** For a new partner: children this person has with no other parent recorded. */
export function orphanChildren(index: TreeIndex, req: AddRequest): { familyId: string; people: Person[] } | null {
  if (req.relation !== 'partner') return null;
  const fam = index.singleParentFamily(req.personId);
  if (!fam?.children.length) return null;
  return { familyId: fam.id, people: fam.children.map((c) => index.person(c.personId)).filter((p): p is Person => !!p) };
}

/** People who cannot be linked this way without creating a loop or a duplicate. */
export function excludedPeople(index: TreeIndex, req: AddRequest, otherParentId: string | null, relation: ChildRelation): Set<string> {
  const id = req.personId;
  const out = new Set<string>([id]);
  const add = (ids: Iterable<string>) => {
    for (const x of ids) out.add(x);
  };
  switch (req.relation) {
    case 'parent':
      add(index.descendants(id));
      add(index.allParents(id).map((p) => p.id));
      break;
    case 'partner':
      add(index.ancestors(id));
      add(index.descendants(id));
      add(index.partners(id).map((p) => p.id));
      break;
    case 'child':
      add(index.ancestors(id));
      if (otherParentId) {
        out.add(otherParentId);
        add(index.ancestors(otherParentId));
      }
      add(index.children(id).map((p) => p.id));
      if (relation === 'biological') {
        for (const p of index.doc.people) if (index.primaryParentFamily(p.id)) out.add(p.id);
      }
      break;
    case 'sibling':
      add(index.ancestors(id));
      add(index.descendants(id));
      add(index.siblings(id).map((p) => p.id));
      for (const p of index.doc.people) if (index.parentFamilies(p.id).length) out.add(p.id);
      break;
  }
  return out;
}
