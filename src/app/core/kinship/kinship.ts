/**
 * How everyone in a tree is related to one person: mother, cousin once removed,
 * sister-in-law, stepson, wife's cousin. The result is language-neutral; the
 * language packs in core/lang turn it into words.
 *
 * Blood relations are found through the nearest common ancestor: someone `up`
 * generations above the focus person and `down` generations above the relative.
 * Partners, step relations, in-laws and partners of relatives are layered on
 * top, nearest first. Anything further away is described through one link
 * ("cousin's wife", "wife's cousin") or left unnamed.
 */
import { RelationshipStatus, isBrokenUp, relationshipStatus } from '../model/relationship';
import { TreeIndex } from '../model/tree-index';
import { ChildRelation, Family, Sex } from '../model/types';

export type StepRelation = 'parent' | 'child' | 'sibling' | 'grandparent' | 'grandchild';
export type InLawRelation = 'parent' | 'child' | 'sibling' | 'grandparent' | 'grandchild';

export type Kin =
  | { kind: 'self' }
  /**
   * A relative through parents and children (birth or adoption). `up` and `down`
   * count generations to the nearest common ancestor. `pivotSex` is the sex of
   * the person a "removed" cousin relation turns on (the focus person's ancestor
   * or the cousin), for languages that describe those relations in words.
   */
  | {
      kind: 'line';
      up: number;
      down: number;
      half?: boolean;
      /** For parents and children: how the link was made. */
      via?: 'adopted' | 'foster';
      /** A birth parent of someone who also has adoptive parents. */
      birth?: boolean;
      /** The partner of an aunt or uncle (called aunt or uncle too). */
      byMarriage?: boolean;
      pivotSex?: Sex;
    }
  | { kind: 'partner'; status: RelationshipStatus; married: boolean; late?: boolean }
  | { kind: 'step'; rel: StepRelation }
  /** `link` is the person the relation runs through: the partner, or the relative who married. */
  | { kind: 'inlaw'; rel: InLawRelation; link: { kin: Kin; sex: Sex } }
  /** X is `second` of someone who is `first` of the focus person. */
  | { kind: 'via'; first: Kin; firstSex: Sex; second: Kin };

/** Parent links that make kin: birth and adoption (and links whose kind nobody recorded). */
const LINEAGE: ReadonlySet<ChildRelation> = new Set(['biological', 'adopted', 'unknown']);

interface LineInfo {
  up: number;
  down: number;
  half: boolean;
  pivot?: string;
}

/**
 * Relatives of `focusId` through parents and children, with the generations up
 * to and down from the nearest common ancestor.
 *
 * Common ancestors are families as well as people: siblings descend from one
 * family (even when nobody entered their parents), half-siblings only from one
 * person who had children in two families.
 */
export function bloodRelatives(index: TreeIndex, focusId: string): Map<string, LineInfo> {
  const best = new Map<string, LineInfo>();
  if (!index.person(focusId)) return best;

  // Families above the focus person, the child each one leads down to, and the
  // ancestors in them with the family the focus person's line comes through.
  const famUp = new Map<Family, number>();
  const famChild = new Map<Family, string>();
  const personUp = new Map<string, { up: number; fam: Family }>();
  const queue: [string, number][] = [[focusId, 0]];
  // The queue grows while it is walked; for-of visits the added entries too.
  for (const [id, u] of queue) {
    for (const fam of index.parentFamilies(id)) {
      if (!LINEAGE.has(index.childRelation(fam, id)) || famUp.has(fam)) continue;
      famUp.set(fam, u + 1);
      famChild.set(fam, id);
      for (const p of fam.partners) {
        if (personUp.has(p) || p === focusId) continue;
        personUp.set(p, { up: u + 1, fam });
        queue.push([p, u + 1]);
      }
    }
  }

  /** The focus person's ancestor `steps` generations below a family on the line. */
  const downTheLine = (fam: Family, steps: number): string => {
    let person = famChild.get(fam)!;
    for (let k = 1; k < steps; k++) {
      fam = personUp.get(person)!.fam;
      person = famChild.get(fam)!;
    }
    return person;
  };

  const offer = (x: string, a: number, d: number, half: boolean, pivot: () => string | undefined) => {
    if (x === focusId) return;
    const prev = best.get(x);
    if (prev) {
      const total = a + d;
      const prevTotal = prev.up + prev.down;
      if (total > prevTotal) return;
      if (total === prevTotal && ((half && !prev.half) || (half === prev.half && a >= prev.up))) return;
    }
    const info: LineInfo = { up: a, down: d, half };
    if (a >= 2 && d >= 2 && a !== d) info.pivot = pivot();
    best.set(x, info);
  };

  /** Everyone descending from `start`, with their depth and their parent on the line. */
  const descend = (start: readonly Family[], found: (x: string, d: number, lineParent: Map<string, string>) => void) => {
    const lineParent = new Map<string, string>();
    const seenFams = new Set<Family>(start);
    const seen = new Set<string>();
    const q: [Family, number, string | undefined][] = start.map((f) => [f, 1, undefined]);
    for (const [fam, d, parent] of q) {
      for (const c of fam.children) {
        if (!LINEAGE.has(c.relation) || seen.has(c.personId)) continue;
        seen.add(c.personId);
        if (parent) lineParent.set(c.personId, parent);
        found(c.personId, d, lineParent);
        for (const f2 of index.partnerFamilies(c.personId)) {
          if (seenFams.has(f2)) continue;
          seenFams.add(f2);
          q.push([f2, d + 1, c.personId]);
        }
      }
    }
  };
  const upTheLine = (lineParent: Map<string, string>, x: string, steps: number): string | undefined => {
    let node: string | undefined = x;
    for (let k = 0; k < steps && node; k++) node = lineParent.get(node);
    return node;
  };

  // The focus person's own descendants.
  descend(index.partnerFamilies(focusId), (x, d) => offer(x, 0, d, false, () => undefined));

  // Full relations: descendants of a family above the focus person.
  for (const [fam, a] of [...famUp.entries()].sort((x, y) => x[1] - y[1])) {
    descend([fam], (x, d, lineParent) => offer(x, a, d, false, () => (a > d ? downTheLine(fam, d) : upTheLine(lineParent, x, d - a))));
  }

  // Ancestors themselves, and half relations through their other families.
  for (const [person, { up: a, fam: ownLine }] of [...personUp.entries()].sort((x, y) => x[1].up - y[1].up)) {
    offer(person, a, 0, false, () => undefined);
    const others = index.partnerFamilies(person).filter((f) => f !== ownLine);
    descend(others, (x, d, lineParent) => offer(x, a, d, true, () => (a > d ? downTheLine(ownLine, d) : upTheLine(lineParent, x, d - a))));
  }
  return best;
}

/** Relationship of everyone to `focusId`. People who are not related are left out. */
export function kinship(index: TreeIndex, focusId: string | undefined): Map<string, Kin> {
  const out = new Map<string, Kin>();
  const focus = index.person(focusId);
  if (!focus || !focusId) return out;
  const me: string = focusId;
  const sexOf = (id: string): Sex => index.person(id)?.sex ?? 'unknown';
  const set = (id: string, kin: Kin) => {
    if (!out.has(id) && index.person(id)) out.set(id, kin);
  };

  out.set(focusId, { kind: 'self' });

  // Partners come first: a cousin one married is called husband or wife.
  const partnerFamilies = index.partnerFamilies(focusId).filter((f) => f.partners.length === 2);
  const partnerKin = new Map<string, Kin & { kind: 'partner' }>();
  for (const fam of partnerFamilies) {
    const other = fam.partners.find((p) => p !== focusId);
    if (!other) continue;
    const kin: Kin & { kind: 'partner' } = {
      kind: 'partner',
      status: relationshipStatus(fam),
      married: fam.kind === 'marriage',
    };
    if (index.person(other)?.death && !focus.death) kin.late = true;
    partnerKin.set(other, kin);
  }
  for (const [id, kin] of partnerKin) out.set(id, kin);

  // Blood and adoptive relatives.
  const blood = bloodRelatives(index, focusId);
  const adopted = index.parentFamilies(focusId).some((f) => index.childRelation(f, focusId) === 'adopted');
  const lineKin = (id: string, info: LineInfo): Kin => {
    const kin: Kin & { kind: 'line' } = { kind: 'line', up: info.up, down: info.down };
    if (info.half) kin.half = true;
    if (info.pivot) kin.pivotSex = sexOf(info.pivot);
    if (info.up === 1 && info.down === 0) {
      const fam = index.parentFamilies(focusId).find((f) => f.partners.includes(id));
      const rel = fam ? index.childRelation(fam, focusId) : 'biological';
      if (rel === 'adopted') kin.via = 'adopted';
      else if (adopted) kin.birth = true;
    } else if (info.up === 0 && info.down === 1) {
      const fam = index.partnerFamilies(focusId).find((f) => f.children.some((c) => c.personId === id));
      if (fam && index.childRelation(fam, id) === 'adopted') kin.via = 'adopted';
    }
    return kin;
  };
  const byCloseness = [...blood.entries()].filter(([id]) => id !== focusId).sort((a, b) => a[1].up + a[1].down - (b[1].up + b[1].down));
  for (const [id, info] of byCloseness) set(id, lineKin(id, info));

  // Foster and step links recorded on the child.
  for (const fam of index.parentFamilies(focusId)) {
    const rel = index.childRelation(fam, focusId);
    for (const p of fam.partners) {
      if (rel === 'foster') set(p, { kind: 'line', up: 1, down: 0, via: 'foster' });
      else if (rel === 'step') set(p, { kind: 'step', rel: 'parent' });
    }
  }
  for (const fam of index.partnerFamilies(focusId)) {
    for (const c of fam.children) {
      if (c.relation === 'foster') set(c.personId, { kind: 'line', up: 0, down: 1, via: 'foster' });
      else if (c.relation === 'step') set(c.personId, { kind: 'step', rel: 'child' });
    }
  }

  // Partners of blood relatives: step-parents, sons-in-law, aunts by marriage, cousins' wives.
  for (const [relativeId, info] of byCloseness) {
    const relativeKin = out.get(relativeId);
    if (!relativeKin || relativeKin.kind !== 'line') continue;
    for (const fam of index.partnerFamilies(relativeId)) {
      const x = fam.partners.find((p) => p !== relativeId);
      if (!x || out.has(x)) continue;
      const status = relationshipStatus(fam);
      const together = !isBrokenUp(status);
      const married = fam.kind === 'marriage';
      const { up, down } = info;
      const link = { kin: relativeKin, sex: sexOf(relativeId) };
      const partner: Kin = { kind: 'partner', status, married };
      if (together && up === 1 && down === 0) set(x, { kind: 'step', rel: 'parent' });
      else if (together && up === 2 && down === 0) set(x, { kind: 'step', rel: 'grandparent' });
      else if (together && married && up === 0 && down === 1) set(x, { kind: 'inlaw', rel: 'child', link });
      else if (together && married && up === 0 && down === 2) set(x, { kind: 'inlaw', rel: 'grandchild', link });
      else if (together && married && up === 1 && down === 1) set(x, { kind: 'inlaw', rel: 'sibling', link });
      else if (together && married && up >= 2 && down === 1) set(x, { kind: 'line', up, down, byMarriage: true });
      else set(x, { kind: 'via', first: relativeKin, firstSex: link.sex, second: partner });
    }
  }

  // The partner's relatives: parents-in-law, stepchildren, the wife's cousin.
  const partnersInOrder = [...partnerFamilies].sort((a, b) => Number(isBrokenUp(relationshipStatus(a))) - Number(isBrokenUp(relationshipStatus(b))));
  for (const fam of partnersInOrder) {
    const other = otherPartner(fam, me);
    if (!other) continue;
    const partnerId: string = other;
    const pKin = partnerKin.get(partnerId)!;
    const together = !isBrokenUp(pKin.status);
    const married = fam.kind === 'marriage';
    const link = { kin: pKin as Kin, sex: sexOf(partnerId) };
    const theirs = bloodRelatives(index, partnerId);
    const ordered = [...theirs.entries()].filter(([id]) => id !== partnerId && id !== focusId).sort((a, b) => a[1].up + a[1].down - (b[1].up + b[1].down));
    for (const [x, info] of ordered) {
      if (out.has(x)) continue;
      const { up, down } = info;
      if (together && up === 0 && down === 1) set(x, { kind: 'step', rel: 'child' });
      else if (together && up === 0 && down === 2) set(x, { kind: 'step', rel: 'grandchild' });
      else if (married && up === 1 && down === 0) set(x, { kind: 'inlaw', rel: 'parent', link });
      else if (married && up === 1 && down === 1) set(x, { kind: 'inlaw', rel: 'sibling', link });
      else if (married && up === 2 && down === 0) set(x, { kind: 'inlaw', rel: 'grandparent', link });
      else {
        const second: Kin = { kind: 'line', up, down };
        if (info.half) second.half = true;
        if (info.pivot) second.pivotSex = sexOf(info.pivot);
        set(x, { kind: 'via', first: pKin, firstSex: link.sex, second });
      }
    }
    // The partner's other partners: "wife's ex-husband".
    for (const f2 of index.partnerFamilies(partnerId)) {
      const y = otherPartner(f2, partnerId);
      if (!y || y === focusId || out.has(y)) continue;
      set(y, { kind: 'via', first: pKin, firstSex: link.sex, second: { kind: 'partner', status: relationshipStatus(f2), married: f2.kind === 'marriage' } });
    }
    // The partner's siblings' partners are brothers- and sisters-in-law too.
    if (married && together) {
      for (const [sib, info] of theirs) {
        if (info.up !== 1 || info.down !== 1) continue;
        for (const f2 of index.partnerFamilies(sib)) {
          const y = otherPartner(f2, sib);
          if (y && f2.kind === 'marriage' && !isBrokenUp(relationshipStatus(f2))) set(y, { kind: 'inlaw', rel: 'sibling', link });
        }
      }
    }
  }

  // Children of step-parents are stepbrothers and stepsisters.
  for (const [id, kin] of [...out]) {
    if (kin.kind !== 'step' || kin.rel !== 'parent') continue;
    for (const child of index.children(id)) set(child.id, { kind: 'step', rel: 'sibling' });
  }

  return out;
}

function otherPartner(fam: Family, id: string): string | undefined {
  return fam.partners.find((p) => p !== id);
}

/** Generation offset of a relationship: negative above the focus person, positive below. */
export function kinGeneration(kin: Kin): number | undefined {
  switch (kin.kind) {
    case 'self':
    case 'partner':
      return 0;
    case 'line':
      return kin.down - kin.up;
    default:
      return undefined;
  }
}
