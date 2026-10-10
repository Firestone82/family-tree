/**
 * Pure editing operations. Each takes a document and returns a new one; the input
 * is never mutated, which is what makes undo/redo a matter of keeping snapshots.
 * Operations throw TreeOperationError with a code to translate and an English message.
 */
import { eventSortKey } from './dates';
import { newId } from './ids';
import { Notice, NoticeParams } from './notice';
import { displayName } from './names';
import { RelationshipStatus, statusChange } from './relationship';
import { TreeIndex } from './tree-index';
import {
  ChildRelation,
  Family,
  FamilyChild,
  FamilyKind,
  DEFAULT_PRINT,
  effectivePrint,
  LifeEvent,
  Person,
  PersonName,
  PrintSettings,
  Sex,
  TreeDocument,
  TreeMeta,
  ViewSettings,
} from './types';

/** Why an edit was refused. `code` and `params` are for translation; `message` is the English text. */
export class TreeOperationError extends Error implements Notice {
  readonly text: string;

  constructor(
    readonly code: OperationErrorCode,
    message: string,
    readonly params: NoticeParams = {},
  ) {
    super(message);
    this.text = message;
    this.name = 'TreeOperationError';
  }
}

export type OperationErrorCode =
  | 'own-parent'
  | 'descendant-as-parent'
  | 'already-parent'
  | 'two-parents'
  | 'own-partner'
  | 'already-partners'
  | 'kin-as-partner'
  | 'partner-related-to-children'
  | 'own-child'
  | 'ancestor-as-child'
  | 'has-parents'
  | 'already-child'
  | 'own-sibling'
  | 'kin-as-sibling'
  | 'already-sibling'
  | 'sibling-has-parents'
  | 'person-missing'
  | 'family-missing';

export interface PersonDraft {
  given?: string;
  surname?: string;
  birthSurname?: string;
  nickname?: string;
  sex?: Sex;
  birth?: LifeEvent;
  death?: LifeEvent;
  occupation?: string;
  notes?: string;
}

/** Either a person already in the tree or the details of a new one. */
export type PersonSource = { existingId: string } | { draft: PersonDraft };

export interface OpResult {
  doc: TreeDocument;
  /** The person that was created or linked. */
  personId: string;
  /** The family that received the link. */
  familyId: string;
}

export type PersonPatch = Partial<Omit<Person, 'id' | 'name'>> & { name?: Partial<PersonName> };
export type FamilyPatch = Partial<Pick<Family, 'kind' | 'engagement' | 'start' | 'end' | 'notes'>>;

// ---------------------------------------------------------------------------
// people

export function draftToPerson(id: string, draft: PersonDraft): Person {
  const person: Person = {
    id,
    sex: draft.sex ?? 'unknown',
    name: {
      given: (draft.given ?? '').trim(),
      surname: (draft.surname ?? '').trim(),
    },
  };
  const birthSurname = draft.birthSurname?.trim();
  if (birthSurname) person.name.birthSurname = birthSurname;
  const nickname = draft.nickname?.trim();
  if (nickname) person.name.nickname = nickname;
  if (draft.birth && (draft.birth.date || draft.birth.place)) person.birth = { ...draft.birth };
  if (draft.death) person.death = { ...draft.death };
  if (draft.occupation?.trim()) person.occupation = draft.occupation.trim();
  if (draft.notes?.trim()) person.notes = draft.notes;
  return person;
}

export function addPerson(doc: TreeDocument, draft: PersonDraft): { doc: TreeDocument; personId: string } {
  const id = newId('I', takenIds(doc));
  return { doc: { ...doc, people: [...doc.people, draftToPerson(id, draft)] }, personId: id };
}

export function updatePerson(doc: TreeDocument, id: string, patch: PersonPatch): TreeDocument {
  requirePerson(doc, id);
  return {
    ...doc,
    people: doc.people.map((p) => {
      if (p.id !== id) return p;
      const next: Person = { ...p, ...patch, id: p.id, name: { ...p.name, ...(patch.name ?? {}) } };
      for (const key of Object.keys(patch) as (keyof PersonPatch)[]) {
        if (patch[key] === undefined) delete (next as unknown as Record<string, unknown>)[key];
      }
      if (patch.name) {
        for (const key of Object.keys(patch.name) as (keyof PersonName)[]) {
          if (patch.name[key] === undefined) delete next.name[key];
        }
        next.name.given ??= '';
        next.name.surname ??= '';
      }
      return next;
    }),
  };
}

/** Removes a person and every link to them. Families left meaningless are removed too. */
export function deletePerson(doc: TreeDocument, id: string): TreeDocument {
  requirePerson(doc, id);
  const affected: string[] = [];
  const families = doc.families.map((f) => {
    if (!f.partners.includes(id) && !f.children.some((c) => c.personId === id)) return f;
    affected.push(f.id);
    return {
      ...f,
      partners: f.partners.filter((p) => p !== id),
      children: f.children.filter((c) => c.personId !== id),
    };
  });
  const meta = doc.meta.homePersonId === id ? withoutKey(doc.meta, 'homePersonId') : doc.meta;
  let print = doc.print;
  if (print?.centerId === id) print = withoutKey(withoutKey(print, 'centerId'), 'partnerId');
  if (print?.partnerId === id) print = withoutKey(print, 'partnerId');
  const next: TreeDocument = { ...doc, meta, people: doc.people.filter((p) => p.id !== id), families };
  if (print) next.print = print;
  return cleanupFamilies(next, affected);
}

// ---------------------------------------------------------------------------
// relationships

/**
 * Adds a parent to `childId`.
 * - If the child's parents have a free slot, the new parent fills it, which also
 *   makes them the parent of the child's full siblings. Pass `onlyThisChild` to
 *   give the child a family of its own with the known parent instead.
 * - Adoptive, foster and step parents get a separate family.
 */
export function addParent(
  doc: TreeDocument,
  childId: string,
  source: PersonSource,
  relation: ChildRelation = 'biological',
  options: { onlyThisChild?: boolean } = {},
): OpResult {
  requirePerson(doc, childId);
  const index = new TreeIndex(doc);
  const { doc: withParent, personId: parentId } = resolveSource(doc, source);
  const child = index.person(childId)!;

  if (parentId === childId) throw new TreeOperationError('own-parent', 'A person cannot be their own parent.');
  if ('existingId' in source) {
    const names = { parent: displayName(index.person(parentId)), child: displayName(child) };
    if (index.descendants(childId).has(parentId)) {
      throw new TreeOperationError('descendant-as-parent', `${names.parent} is a descendant of ${names.child}, so they cannot also be a parent.`, names);
    }
    if (index.allParents(childId).some((p) => p.id === parentId)) {
      throw new TreeOperationError('already-parent', `${names.parent} is already a parent of ${names.child}.`, names);
    }
  }

  const current = index.primaryParentFamily(childId);
  const currentRelation = current ? index.childRelation(current, childId) : undefined;
  const sameKind = current && relationGroup(currentRelation!) === relationGroup(relation);

  if (current && sameKind && current.partners.length < 2) {
    const siblings = current.children.filter((c) => c.personId !== childId);
    if (options.onlyThisChild && siblings.length > 0 && current.partners.length === 1) {
      // Split the child out into a family with the known parent and the new one.
      const known = current.partners[0];
      let next = removeChildFrom(withParent, current.id, childId);
      const existing = new TreeIndex(next).familyBetween(known, parentId);
      if (existing) {
        next = insertChild(next, existing.id, { personId: childId, relation: currentRelation ?? relation });
        return { doc: next, personId: parentId, familyId: existing.id };
      }
      const famId = newId('F', takenIds(next));
      const fam: Family = {
        id: famId,
        kind: 'marriage',
        partners: [known, parentId],
        children: [{ personId: childId, relation: currentRelation ?? relation }],
      };
      return { doc: cleanupFamilies({ ...next, families: [...next.families, fam] }, [current.id]), personId: parentId, familyId: famId };
    }
    const updated: Family = { ...current, partners: [...current.partners, parentId] };
    if (current.partners.length === 0 && current.kind === 'unknown') updated.kind = 'marriage';
    return { doc: replaceFamily(withParent, updated), personId: parentId, familyId: current.id };
  }

  if (current && sameKind && relation === 'biological') {
    throw new TreeOperationError('two-parents', `${displayName(child)} already has two parents.`, { child: displayName(child) });
  }

  // A separate family for adoptive, foster or step parents, or the first parent.
  const famId = newId('F', takenIds(withParent));
  const family: Family = {
    id: famId,
    kind: 'marriage',
    partners: [parentId],
    children: [{ personId: childId, relation }],
  };
  return { doc: { ...withParent, families: [...withParent.families, family] }, personId: parentId, familyId: famId };
}

export interface AddPartnerOptions {
  kind?: FamilyKind;
  /** The couple's status, such as divorced or widowed; it decides the kind of family. */
  status?: RelationshipStatus;
  /** A family where `personId` is the only parent; the partner becomes its other parent. */
  joinFamilyId?: string;
}

export function addPartner(doc: TreeDocument, personId: string, source: PersonSource, options: AddPartnerOptions = {}): OpResult {
  requirePerson(doc, personId);
  const index = new TreeIndex(doc);
  const { doc: withPartner, personId: partnerId } = resolveSource(doc, source);
  if (partnerId === personId) throw new TreeOperationError('own-partner', 'A person cannot be their own partner.');
  if ('existingId' in source) {
    if (index.familyBetween(personId, partnerId)) {
      const names = { a: displayName(index.person(personId)), b: displayName(index.person(partnerId)) };
      throw new TreeOperationError('already-partners', `${names.a} and ${names.b} are already partners.`, names);
    }
    if (index.ancestors(personId).has(partnerId) || index.descendants(personId).has(partnerId)) {
      throw new TreeOperationError('kin-as-partner', 'A parent or ancestor cannot also be a partner. Check the relationship you picked.');
    }
  }

  if (options.joinFamilyId) {
    const fam = withPartner.families.find((f) => f.id === options.joinFamilyId);
    if (fam && fam.partners.length === 1 && fam.partners[0] === personId) {
      const updated: Family = { ...fam, partners: [personId, partnerId] };
      if (options.kind) updated.kind = options.kind;
      if ('existingId' in source && fam.children.some((c) => c.personId === partnerId || new TreeIndex(withPartner).ancestors(c.personId).has(partnerId))) {
        throw new TreeOperationError('partner-related-to-children', 'That person is already related to these children as a child or descendant.');
      }
      return withStatus({ doc: replaceFamily(withPartner, updated), personId: partnerId, familyId: fam.id }, options.status);
    }
  }

  const famId = newId('F', takenIds(withPartner));
  const family: Family = { id: famId, kind: options.kind ?? 'marriage', partners: [personId, partnerId], children: [] };
  return withStatus({ doc: { ...withPartner, families: [...withPartner.families, family] }, personId: partnerId, familyId: famId }, options.status);
}

/** Applies a relationship status to the family an add operation made or joined. */
function withStatus(result: OpResult, status: RelationshipStatus | undefined): OpResult {
  return status ? { ...result, doc: setRelationshipStatus(result.doc, result.familyId, status) } : result;
}

export interface AddChildOptions {
  /** The child's other parent. `null` means unknown or none. */
  otherParentId: string | null;
  relation?: ChildRelation;
}

export function addChild(doc: TreeDocument, personId: string, source: PersonSource, options: AddChildOptions): OpResult {
  requirePerson(doc, personId);
  const relation = options.relation ?? 'biological';
  const index = new TreeIndex(doc);
  const { doc: withChild, personId: childId } = resolveSource(doc, source);
  const parentIds = options.otherParentId ? [personId, options.otherParentId] : [personId];

  if (parentIds.includes(childId)) throw new TreeOperationError('own-child', 'A person cannot be their own child.');
  if ('existingId' in source) {
    const ancestors = index.ancestors(personId);
    if (options.otherParentId) for (const a of index.ancestors(options.otherParentId)) ancestors.add(a);
    const child = displayName(index.person(childId));
    if (ancestors.has(childId)) {
      throw new TreeOperationError('ancestor-as-child', `${child} is an ancestor here, so they cannot also be a child.`, { child });
    }
    const primary = index.primaryParentFamily(childId);
    if (primary && relationGroup(relation) === relationGroup(index.childRelation(primary, childId))) {
      throw new TreeOperationError('has-parents', `${child} already has parents. Add the link from those parents instead, or choose an adoptive relation.`, {
        child,
      });
    }
  }

  const freshIndex = new TreeIndex(withChild);
  let family = options.otherParentId ? freshIndex.familyBetween(personId, options.otherParentId) : freshIndex.singleParentFamily(personId);

  if (family?.children.some((c) => c.personId === childId)) {
    throw new TreeOperationError('already-child', 'This child is already listed in that family.');
  }

  if (!family) {
    if (options.otherParentId) requirePerson(withChild, options.otherParentId);
    const famId = newId('F', takenIds(withChild));
    family = { id: famId, kind: 'marriage', partners: parentIds, children: [] };
    const next = { ...withChild, families: [...withChild.families, family] };
    return { doc: insertChild(next, famId, { personId: childId, relation }), personId: childId, familyId: famId };
  }
  return { doc: insertChild(withChild, family.id, { personId: childId, relation }), personId: childId, familyId: family.id };
}

/**
 * Adds a full sibling. When the person has no recorded parents, the two are
 * grouped in a family with unknown parents, which can be filled in later.
 */
export function addSibling(doc: TreeDocument, personId: string, source: PersonSource): OpResult {
  requirePerson(doc, personId);
  const index = new TreeIndex(doc);
  const { doc: withSibling, personId: siblingId } = resolveSource(doc, source);
  if (siblingId === personId) throw new TreeOperationError('own-sibling', 'A person cannot be their own sibling.');
  const family = index.primaryParentFamily(personId);

  if ('existingId' in source) {
    const sibling = displayName(index.person(siblingId));
    if (index.ancestors(personId).has(siblingId) || index.descendants(personId).has(siblingId)) {
      throw new TreeOperationError('kin-as-sibling', 'An ancestor or descendant cannot also be a sibling.');
    }
    if (family?.children.some((c) => c.personId === siblingId)) {
      throw new TreeOperationError('already-sibling', `${sibling} is already a sibling.`, { sibling });
    }
    if (index.parentFamilies(siblingId).length > 0) {
      throw new TreeOperationError('sibling-has-parents', `${sibling} already has parents. Link the two families through the parents instead.`, { sibling });
    }
  }

  if (family) {
    const relation = index.childRelation(family, personId);
    return { doc: insertChild(withSibling, family.id, { personId: siblingId, relation }), personId: siblingId, familyId: family.id };
  }
  const famId = newId('F', takenIds(withSibling));
  const fam: Family = {
    id: famId,
    kind: 'unknown',
    partners: [],
    children: [{ personId, relation: 'biological' }],
  };
  const next = { ...withSibling, families: [...withSibling.families, fam] };
  return { doc: insertChild(next, famId, { personId: siblingId, relation: 'biological' }), personId: siblingId, familyId: famId };
}

// ---------------------------------------------------------------------------
// families

export function updateFamily(doc: TreeDocument, familyId: string, patch: FamilyPatch): TreeDocument {
  const fam = requireFamily(doc, familyId);
  const next: Family = { ...fam, ...patch };
  for (const key of Object.keys(patch) as (keyof FamilyPatch)[]) {
    if (patch[key] === undefined) delete next[key];
  }
  return replaceFamily(doc, next);
}

/** Sets married, engaged, divorced and so on, keeping dates and places that still apply. */
export function setRelationshipStatus(doc: TreeDocument, familyId: string, status: RelationshipStatus): TreeDocument {
  const fam = requireFamily(doc, familyId);
  const change = statusChange(fam, status);
  return updateFamily(doc, familyId, { kind: change.kind, engagement: change.engagement, end: change.end });
}

export function setChildRelation(doc: TreeDocument, familyId: string, childId: string, relation: ChildRelation): TreeDocument {
  const fam = requireFamily(doc, familyId);
  return replaceFamily(doc, {
    ...fam,
    children: fam.children.map((c) => (c.personId === childId ? { ...c, relation } : c)),
  });
}

/** Detaches a child from a family (the people stay in the tree). */
export function removeChild(doc: TreeDocument, familyId: string, childId: string): TreeDocument {
  requireFamily(doc, familyId);
  return cleanupFamilies(removeChildFrom(doc, familyId, childId), [familyId]);
}

/** Removes a partner from a family; the children stay with the other partner. */
export function removePartner(doc: TreeDocument, familyId: string, personId: string): TreeDocument {
  const fam = requireFamily(doc, familyId);
  return cleanupFamilies(replaceFamily(doc, { ...fam, partners: fam.partners.filter((p) => p !== personId) }), [familyId]);
}

export function deleteFamily(doc: TreeDocument, familyId: string): TreeDocument {
  requireFamily(doc, familyId);
  return { ...doc, families: doc.families.filter((f) => f.id !== familyId) };
}

export function moveChild(doc: TreeDocument, familyId: string, childId: string, delta: number): TreeDocument {
  const fam = requireFamily(doc, familyId);
  const from = fam.children.findIndex((c) => c.personId === childId);
  if (from < 0) return doc;
  const to = Math.max(0, Math.min(fam.children.length - 1, from + delta));
  if (to === from) return doc;
  const children = [...fam.children];
  const [item] = children.splice(from, 1);
  children.splice(to, 0, item);
  return replaceFamily(doc, { ...fam, children });
}

/** Reorders a family's children by birth date; undated children keep their place. */
export function sortChildrenByBirth(doc: TreeDocument, familyId: string): TreeDocument {
  const fam = requireFamily(doc, familyId);
  const people = new Map(doc.people.map((p) => [p.id, p]));
  const dated = fam.children
    .map((c, i) => ({ c, i, key: eventSortKey(people.get(c.personId)?.birth) }))
    .filter((x) => x.key !== undefined)
    .sort((a, b) => a.key! - b.key! || a.i - b.i);
  const slots = fam.children.map((c, i) => (eventSortKey(people.get(c.personId)?.birth) !== undefined ? i : -1)).filter((i) => i >= 0);
  const children = [...fam.children];
  slots.forEach((slot, n) => (children[slot] = dated[n].c));
  return replaceFamily(doc, { ...fam, children });
}

// ---------------------------------------------------------------------------
// document

export function updateMeta(doc: TreeDocument, patch: Partial<TreeMeta>): TreeDocument {
  const meta: TreeMeta = { ...doc.meta, ...patch };
  for (const key of Object.keys(patch) as (keyof TreeMeta)[]) {
    if (patch[key] === undefined) delete meta[key];
  }
  return { ...doc, meta };
}

export function updateView(doc: TreeDocument, patch: Partial<ViewSettings>): TreeDocument {
  return { ...doc, view: { ...doc.view, ...patch } };
}

/** Changes print settings; keys set to undefined are removed (back to their default). */
export function updatePrint(doc: TreeDocument, patch: Partial<PrintSettings>): TreeDocument {
  const print: PrintSettings = { ...DEFAULT_PRINT, ...effectivePrint(doc), ...patch };
  for (const key of Object.keys(patch) as (keyof PrintSettings)[]) {
    if (patch[key] === undefined) delete print[key];
  }
  return { ...doc, print };
}

/**
 * Removes the given families when an edit left them recording nothing: one
 * partner and no children, or no partners and at most one child.
 */
export function cleanupFamilies(doc: TreeDocument, affected: Iterable<string>): TreeDocument {
  const check = new Set(affected);
  const keep = doc.families.filter((f) => {
    if (!check.has(f.id)) return true;
    if (f.partners.length === 0) return f.children.length >= 2;
    if (f.partners.length === 1) return f.children.length >= 1;
    return true;
  });
  return keep.length === doc.families.length ? doc : { ...doc, families: keep };
}

// ---------------------------------------------------------------------------
// helpers

function relationGroup(relation: ChildRelation): 'birth' | 'other' {
  return relation === 'biological' || relation === 'unknown' ? 'birth' : 'other';
}

function resolveSource(doc: TreeDocument, source: PersonSource): { doc: TreeDocument; personId: string } {
  if ('existingId' in source) {
    requirePerson(doc, source.existingId);
    return { doc, personId: source.existingId };
  }
  return addPerson(doc, source.draft);
}

function takenIds(doc: TreeDocument): Set<string> {
  const ids = new Set<string>();
  for (const p of doc.people) ids.add(p.id);
  for (const f of doc.families) ids.add(f.id);
  return ids;
}

function requirePerson(doc: TreeDocument, id: string): Person {
  const p = doc.people.find((x) => x.id === id);
  if (!p) throw new TreeOperationError('person-missing', 'That person is no longer in the tree.');
  return p;
}

function requireFamily(doc: TreeDocument, id: string): Family {
  const f = doc.families.find((x) => x.id === id);
  if (!f) throw new TreeOperationError('family-missing', 'That family is no longer in the tree.');
  return f;
}

function replaceFamily(doc: TreeDocument, family: Family): TreeDocument {
  return { ...doc, families: doc.families.map((f) => (f.id === family.id ? family : f)) };
}

function removeChildFrom(doc: TreeDocument, familyId: string, childId: string): TreeDocument {
  return {
    ...doc,
    families: doc.families.map((f) => (f.id === familyId ? { ...f, children: f.children.filter((c) => c.personId !== childId) } : f)),
  };
}

/** Inserts a child keeping birth order when the dates allow it. */
function insertChild(doc: TreeDocument, familyId: string, child: FamilyChild): TreeDocument {
  const fam = requireFamily(doc, familyId);
  const people = new Map(doc.people.map((p) => [p.id, p]));
  const key = eventSortKey(people.get(child.personId)?.birth);
  const children = [...fam.children];
  let at = children.length;
  if (key !== undefined) {
    for (let i = 0; i < children.length; i++) {
      const other = eventSortKey(people.get(children[i].personId)?.birth);
      if (other !== undefined && other > key) {
        at = i;
        break;
      }
    }
  }
  children.splice(at, 0, child);
  return replaceFamily(doc, { ...fam, children });
}

function withoutKey<T extends object, K extends keyof T>(obj: T, key: K): T {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}
