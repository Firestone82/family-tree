/**
 * Which part of the tree goes on a print: the couple in the middle, their
 * ancestors and descendants up to a number of generations, side branches up to
 * a number of steps from the direct line, and everyone's partners.
 */
import { bloodRelatives } from '../kinship/kinship';
import { TreeIndex } from '../model/tree-index';
import { Family, Reach, TreeDocument } from '../model/types';

export interface ScopeOptions {
  centerId: string;
  partnerId?: string;
  ancestors: Reach;
  descendants: Reach;
  branches: Reach;
}

export interface Scope {
  doc: TreeDocument;
  people: ReadonlySet<string>;
}

const limit = (r: Reach) => (r === 'all' ? Infinity : Math.max(0, r));

export function scopeDocument(doc: TreeDocument, index: TreeIndex, options: ScopeOptions): Scope {
  const A = limit(options.ancestors);
  const D = limit(options.descendants);
  const B = limit(options.branches);
  const everyone = A === Infinity && D === Infinity && B === Infinity;

  const included = new Set<string>();
  if (everyone) {
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
      people: doc.people.filter((p) => included.has(p.id)),
      families,
      ...(doc.background ? { background: doc.background } : {}),
    },
    people: included,
  };
}
