import { eventSortKey } from './dates';
import { ChildRelation, Family, Person, TreeDocument } from './types';

const RELATION_PRIORITY: Record<ChildRelation, number> = {
  biological: 0,
  adopted: 1,
  foster: 2,
  step: 3,
  unknown: 4,
};

/**
 * Read-only lookups over a tree document: who is whose parent, partner, child.
 * Build one per document version; it is cheap for trees of a few thousand people.
 */
export class TreeIndex {
  readonly people = new Map<string, Person>();
  readonly families = new Map<string, Family>();
  private readonly personOrder = new Map<string, number>();
  private readonly familyOrder = new Map<string, number>();
  private readonly parentFams = new Map<string, Family[]>();
  private readonly partnerFams = new Map<string, Family[]>();

  constructor(readonly doc: TreeDocument) {
    doc.people.forEach((p, i) => {
      this.people.set(p.id, p);
      this.personOrder.set(p.id, i);
    });
    doc.families.forEach((f, i) => {
      this.families.set(f.id, f);
      this.familyOrder.set(f.id, i);
      for (const id of f.partners) push(this.partnerFams, id, f);
      for (const c of f.children) push(this.parentFams, c.personId, f);
    });
    for (const [id, list] of this.partnerFams) {
      this.partnerFams.set(id, this.sortFamiliesChronologically(list));
    }
  }

  person(id: string | undefined): Person | undefined {
    return id ? this.people.get(id) : undefined;
  }

  family(id: string | undefined): Family | undefined {
    return id ? this.families.get(id) : undefined;
  }

  order(personId: string): number {
    return this.personOrder.get(personId) ?? Number.MAX_SAFE_INTEGER;
  }

  familyIndex(familyId: string): number {
    return this.familyOrder.get(familyId) ?? Number.MAX_SAFE_INTEGER;
  }

  /** Families in which the person is a child, in document order. */
  parentFamilies(personId: string): readonly Family[] {
    return this.parentFams.get(personId) ?? EMPTY;
  }

  /** Families in which the person is a partner, earliest first. */
  partnerFamilies(personId: string): readonly Family[] {
    return this.partnerFams.get(personId) ?? EMPTY;
  }

  childRelation(family: Family, personId: string): ChildRelation {
    return family.children.find((c) => c.personId === personId)?.relation ?? 'unknown';
  }

  /**
   * The parents the person is drawn under. Biological parents win over adoptive
   * ones, which win over foster and step parents; ties go to document order.
   */
  primaryParentFamily(personId: string): Family | undefined {
    const fams = this.parentFamilies(personId);
    if (fams.length <= 1) return fams[0];
    let best = fams[0];
    let bestRank = RELATION_PRIORITY[this.childRelation(best, personId)];
    for (const f of fams.slice(1)) {
      const rank = RELATION_PRIORITY[this.childRelation(f, personId)];
      if (rank < bestRank) {
        best = f;
        bestRank = rank;
      }
    }
    return best;
  }

  parents(personId: string): Person[] {
    const fam = this.primaryParentFamily(personId);
    return fam ? this.resolve(fam.partners) : [];
  }

  allParents(personId: string): Person[] {
    return this.resolve(unique(this.parentFamilies(personId).flatMap((f) => f.partners)));
  }

  partners(personId: string): Person[] {
    return this.resolve(unique(this.partnerFamilies(personId).flatMap((f) => f.partners.filter((id) => id !== personId))));
  }

  children(personId: string): Person[] {
    return this.resolve(unique(this.partnerFamilies(personId).flatMap((f) => f.children.map((c) => c.personId))));
  }

  siblings(personId: string): Person[] {
    return this.resolve(
      unique(
        this.parentFamilies(personId)
          .flatMap((f) => f.children.map((c) => c.personId))
          .filter((id) => id !== personId),
      ),
    );
  }

  /** Children of the person's parents with other partners: half-brothers and half-sisters. */
  halfSiblings(personId: string): Person[] {
    const own = new Set(this.siblings(personId).map((p) => p.id));
    own.add(personId);
    const out: string[] = [];
    for (const fam of this.parentFamilies(personId)) {
      for (const parent of fam.partners) {
        for (const other of this.partnerFamilies(parent)) {
          if (other === fam) continue;
          for (const c of other.children) if (!own.has(c.personId)) out.push(c.personId);
        }
      }
    }
    return this.resolve(unique(out));
  }

  /** The family whose partners are exactly these two people. */
  familyBetween(a: string, b: string): Family | undefined {
    return this.partnerFamilies(a).find((f) => f.partners.length === 2 && f.partners.includes(b));
  }

  /** The family in which the person is the only known parent. */
  singleParentFamily(personId: string): Family | undefined {
    return this.partnerFamilies(personId).find((f) => f.partners.length === 1);
  }

  /** All people above `personId` through any parent relation. */
  ancestors(personId: string): Set<string> {
    const seen = new Set<string>();
    const stack = [personId];
    while (stack.length) {
      const id = stack.pop()!;
      for (const fam of this.parentFamilies(id)) {
        for (const p of fam.partners) {
          if (!seen.has(p)) {
            seen.add(p);
            stack.push(p);
          }
        }
      }
    }
    seen.delete(personId);
    return seen;
  }

  /** All people below `personId` through any child relation. */
  descendants(personId: string): Set<string> {
    const seen = new Set<string>();
    const stack = [personId];
    while (stack.length) {
      const id = stack.pop()!;
      for (const fam of this.partnerFamilies(id)) {
        for (const c of fam.children) {
          if (!seen.has(c.personId)) {
            seen.add(c.personId);
            stack.push(c.personId);
          }
        }
      }
    }
    seen.delete(personId);
    return seen;
  }

  isAncestor(ancestorId: string, personId: string): boolean {
    return this.ancestors(personId).has(ancestorId);
  }

  /** People connected by any relation, one array per separate tree. */
  components(): string[][] {
    const seen = new Set<string>();
    const result: string[][] = [];
    for (const person of this.doc.people) {
      if (seen.has(person.id)) continue;
      const group: string[] = [];
      const stack = [person.id];
      seen.add(person.id);
      while (stack.length) {
        const id = stack.pop()!;
        group.push(id);
        const fams = [...this.parentFamilies(id), ...this.partnerFamilies(id)];
        for (const fam of fams) {
          for (const other of [...fam.partners, ...fam.children.map((c) => c.personId)]) {
            if (!seen.has(other) && this.people.has(other)) {
              seen.add(other);
              stack.push(other);
            }
          }
        }
      }
      group.sort((a, b) => this.order(a) - this.order(b));
      result.push(group);
    }
    return result;
  }

  private resolve(ids: Iterable<string>): Person[] {
    const out: Person[] = [];
    for (const id of ids) {
      const p = this.people.get(id);
      if (p) out.push(p);
    }
    return out;
  }

  private sortFamiliesChronologically(list: Family[]): Family[] {
    return [...list].sort((a, b) => {
      const ka = eventSortKey(a.start);
      const kb = eventSortKey(b.start);
      if (ka !== undefined && kb !== undefined && ka !== kb) return ka - kb;
      return this.familyIndex(a.id) - this.familyIndex(b.id);
    });
  }
}

const EMPTY: readonly Family[] = Object.freeze([]);

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
