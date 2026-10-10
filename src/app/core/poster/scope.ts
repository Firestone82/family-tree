/**
 * Which part of the tree goes on a print or on the chart: the couple in the
 * middle, their ancestors and descendants up to a number of generations, side
 * branches up to a number of steps from the direct line, and everyone's
 * partners. Without the families of those who married in, only the people
 * whose relationship has a name are kept.
 */
import { bloodRelatives, kinship } from '../kinship/kinship';
import { TreeIndex } from '../model/tree-index';
import { Family, Reach, TreeDocument } from '../model/types';

export interface ScopeOptions {
  centerId: string;
  partnerId?: string;
  ancestors: Reach;
  descendants: Reach;
  branches: Reach;
  /**
   * False leaves out everyone the person in the middle has no relationship name
   * for (the parents of a sister-in-law, a fiancé's family), except partners of
   * the people kept. Defaults to true.
   */
  inLawFamilies?: boolean;
}

export interface Scope {
  doc: TreeDocument;
  people: ReadonlySet<string>;
}

const limit = (r: Reach) => (r === 'all' ? Infinity : Math.max(0, r));

/**
 * The steps of the Relatives setting, from the nearest family out: the direct
 * line, siblings (with aunts, uncles, nieces and nephews), first cousins,
 * everyone with a relationship name, and everyone.
 */
export const RELATIVES = ['direct', 'siblings', 'cousins', 'relatives', 'everyone'] as const;
export type Relatives = (typeof RELATIVES)[number];

/** How the steps are saved: side branches, and the families of those who married in. */
export interface RelativesSettings {
  branches: Reach;
  inLawFamilies: boolean;
}

/** The step for saved settings. More branches than cousins (second cousins, from a file) count as all. */
export function relativesOf(s: RelativesSettings): Relatives {
  if (s.branches === 0) return 'direct';
  if (s.branches === 1) return 'siblings';
  if (s.branches === 2) return 'cousins';
  return s.inLawFamilies ? 'everyone' : 'relatives';
}

export function relativesSettings(r: Relatives): RelativesSettings {
  switch (r) {
    case 'direct':
      return { branches: 0, inLawFamilies: true };
    case 'siblings':
      return { branches: 1, inLawFamilies: true };
    case 'cousins':
      return { branches: 2, inLawFamilies: true };
    case 'relatives':
      return { branches: 'all', inLawFamilies: false };
    case 'everyone':
      return { branches: 'all', inLawFamilies: true };
  }
}

export function scopeDocument(doc: TreeDocument, index: TreeIndex, options: ScopeOptions): Scope {
  const A = limit(options.ancestors);
  const D = limit(options.descendants);
  const B = limit(options.branches);
  const unlimited = A === Infinity && D === Infinity && B === Infinity;
  const namedOnly = options.inLawFamilies === false && !!index.person(options.centerId);

  const included = new Set<string>();
  if (unlimited) {
    for (const p of doc.people) included.add(p.id);
  } else {
    const roots = [options.centerId, options.partnerId].filter((id): id is string => !!id && !!index.person(id));
    for (const root of roots) {
      included.add(root);
      for (const [id, { up, down }] of bloodRelatives(index, root)) {
        // Generations below the root; the common ancestor must be within reach,
        // and side branches are counted from the direct line.
        if (up <= A && down - up <= D && Math.min(up, down) <= B) included.add(id);
      }
      // Foster and step children and parents of the couple themselves.
      if (D >= 1) {
        for (const f of index.partnerFamilies(root)) for (const c of f.children) included.add(c.personId);
      }
      if (A >= 1) {
        for (const f of index.parentFamilies(root)) for (const p of f.partners) included.add(p);
      }
    }
  }
  if (namedOnly) {
    // Relationship names are given from the point of view of the person in the middle.
    const named = kinship(index, options.centerId);
    for (const id of [...included]) if (!named.has(id)) included.delete(id);
  }
  if (!unlimited || namedOnly) {
    // Everyone's partners, so couples stay together.
    for (const id of [...included]) {
      for (const f of index.partnerFamilies(id)) for (const p of f.partners) included.add(p);
    }
  }

  const families: Family[] = [];
  for (const f of doc.families) {
    const partners = f.partners.filter((p) => included.has(p));
    const children = f.children.filter((c) => included.has(c.personId));
    const keep =
      partners.length === 2 || (partners.length === 1 && children.length > 0) || (partners.length === 0 && f.partners.length === 0 && children.length > 1);
    if (!keep) continue;
    families.push(partners.length === f.partners.length && children.length === f.children.length ? f : { ...f, partners, children });
  }

  return {
    doc: {
      meta: { ...doc.meta, homePersonId: options.centerId },
      view: doc.view,
      people: included.size === doc.people.length ? doc.people : doc.people.filter((p) => included.has(p.id)),
      families,
      ...(doc.background ? { background: doc.background } : {}),
      ...(doc.arrangement ? { arrangement: doc.arrangement } : {}),
    },
    people: included,
  };
}
