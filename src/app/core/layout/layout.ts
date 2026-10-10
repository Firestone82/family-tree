/**
 * Automatic family tree layout.
 *
 * 1. Generations: a breadth-first walk gives partners the same row, children the
 *    row below and parents the row above. Conflicts (for example a marriage across
 *    generations) are resolved by pushing people down until every child is below
 *    its parents and partners share a row.
 * 2. Blocks: partners in one row are grouped into a block that is never split.
 * 3. Order: a depth-first pass groups each family's children, then barycentre
 *    sweeps, block flips and adjacent swaps reduce line crossings.
 * 4. Position: rows are balanced alternately against the row above and below.
 *    Each pass solves "stay as close as possible to the desired x, keep the order
 *    and spacing" exactly with weighted isotonic regression (pool adjacent violators).
 * 5. Routing: every family gets a stem, a horizontal bar and a drop per child.
 *    Bars that would overlap in a gap are stacked on separate tracks.
 *
 * Long parent-child links that skip a generation get a chain of thin dummy items,
 * so the line has its own lane through the rows in between.
 */
import { TreeIndex } from '../model/tree-index';
import { ChildRelation, Family, TreeDocument } from '../model/types';
import {
  COMFORTABLE_LAYOUT,
  LayoutCard,
  LayoutConnector,
  LayoutDrop,
  LayoutLink,
  LayoutOptions,
  LayoutPlaceholder,
  LayoutResult,
  LayoutRow,
  LayoutUnion,
  Pt,
  UnionMode,
  toRoman,
} from './layout-types';

type ItemKind = 'block' | 'placeholder' | 'dummy';

interface Item {
  uid: number;
  kind: ItemKind;
  rank: number;
  /** People in a block, left to right. */
  members: string[];
  /** Placeholder: its family. Dummy: the family of the link it carries. */
  familyId?: string;
  /** Dummy: the child the link leads to. */
  childId?: string;
  width: number;
  /** Left edge. */
  x: number;
  up: Edge[];
  down: Edge[];
  /** Document order, for stable tie-breaking. */
  order: number;
  /** Junction offsets for the current member order; cleared when it changes. */
  jcache?: Map<string, number>;
}

/** The children of one family as seen from the row below it, for counting intrusions. */
interface Span {
  upper: Anchor;
  rank: number;
  own: { item: Item; personId?: string }[];
  ownSet: Set<Item>;
}

type Anchor = { kind: 'member'; item: Item; personId: string } | { kind: 'junction'; item: Item; family: Family } | { kind: 'center'; item: Item };

interface Edge {
  upper: Anchor;
  lower: Anchor;
  familyId: string;
  childId: string;
  siblingIndex: number;
  /** Spring strength. Links through dummies are stiffer so long lines stay straight. */
  weight: number;
}

interface ChildLink {
  family: Family;
  childId: string;
  relation: ChildRelation;
  siblingIndex: number;
}

interface Interval {
  lo: number;
  hi: number;
  key: string;
}

const DUMMY_WIDTH = 2;
const BAR_SEPARATION = 18;
const BRIDGE_LIFT = 15;
const BRIDGE_STEP = 7;
const BRIDGE_INSET = 18;
const ENDED_REASONS = new Set(['divorce', 'separation', 'annulment']);

/**
 * Lays out a whole document. `hint` maps person ids to their x position in the
 * previous layout; when given, the previous left-to-right order is kept unless a
 * different order has fewer crossings, so small edits do not reshuffle the chart.
 * `widths` gives some people a card wider than `options.cardWidth`, for a
 * relationship name that would not fit otherwise.
 */
export function computeLayout(
  doc: TreeDocument,
  options: LayoutOptions = COMFORTABLE_LAYOUT,
  hint?: ReadonlyMap<string, number>,
  widths?: ReadonlyMap<string, number>,
): LayoutResult {
  const index = new TreeIndex(doc);
  const components = orderComponents(index, doc.meta.homePersonId);
  const parts: ComponentLayout[] = [];
  let offset = 0;
  for (const people of components) {
    const part = new ComponentLayout(people, index, options, doc.meta.homePersonId, hint, widths);
    part.run();
    part.shift(offset - part.minX());
    offset = part.maxX() + options.componentGap;
    parts.push(part);
  }
  return assemble(parts, options);
}

function orderComponents(index: TreeIndex, homeId: string | undefined): string[][] {
  const comps = index.components();
  return comps
    .map((people, i) => ({ people, i, home: homeId ? people.includes(homeId) : false }))
    .sort((a, b) => Number(b.home) - Number(a.home) || b.people.length - a.people.length || a.i - b.i)
    .map((c) => c.people);
}

// ---------------------------------------------------------------------------

class ComponentLayout {
  readonly rank = new Map<string, number>();
  readonly items: Item[] = [];
  rows: Item[][] = [];
  readonly blockOf = new Map<string, Item>();
  readonly placeholderOf = new Map<string, Item>();
  readonly chains = new Map<string, Item[]>();
  readonly families: Family[] = [];
  readonly primary: ChildLink[] = [];
  readonly secondary: ChildLink[] = [];
  readonly primaryByFamily = new Map<string, ChildLink[]>();
  crossings = 0;

  private readonly primaryFamilyOf = new Map<string, string>();
  private readonly placeholderRank = new Map<string, number>();
  private uid = 0;
  private readonly W: number;
  private readonly Gp: number;

  constructor(
    private readonly people: string[],
    private readonly index: TreeIndex,
    private readonly o: LayoutOptions,
    private readonly homeId: string | undefined,
    private readonly hint?: ReadonlyMap<string, number>,
    private readonly widths?: ReadonlyMap<string, number>,
  ) {
    this.W = o.cardWidth;
    this.Gp = o.partnerGap;
  }

  /** A person's card width: the usual one, or wider for a long relationship name. */
  widthOf(personId: string): number {
    return Math.max(this.W, this.widths?.get(personId) ?? this.W);
  }

  /** Where the card of the block's member `i` starts, from the block's left edge. */
  memberLeft(item: Item, i: number): number {
    let x = 0;
    for (let k = 0; k < i; k++) x += this.widthOf(item.members[k]) + this.Gp;
    return x;
  }

  run(): void {
    this.collectFamilies();
    this.assignRanks();
    this.classifyLinks();
    this.normalizeRanks();
    this.buildBlocks();
    this.buildPlaceholders();
    this.buildEdges();
    this.indexEdges();
    this.orderRows();
    this.place();
  }

  private spans: Span[] = [];
  private spansByRank: Span[][] = [];

  /** Static lookups used by the scoring functions, built once the edges exist. */
  private indexEdges(): void {
    this.edgesByRank = [];
    for (const item of this.items) for (const e of item.down) (this.edgesByRank[item.rank] ??= []).push(e);
    for (const [familyId, links] of this.primaryByFamily) {
      const upper = this.junctionAnchor(links[0].family);
      if (!upper) continue;
      const own: Span['own'] = [];
      for (const l of links) {
        const chain = this.chains.get(chainKey(familyId, l.childId));
        if (chain) own.push({ item: chain[0] });
        else {
          const item = this.blockOf.get(l.childId);
          if (item) own.push({ item, personId: l.childId });
        }
      }
      const span: Span = { upper, rank: upper.item.rank + 1, own, ownSet: new Set(own.map((o) => o.item)) };
      this.spans.push(span);
      (this.spansByRank[span.rank] ??= []).push(span);
    }
  }

  /**
   * Crossing reduction is a local search, so it runs from several starting
   * orders and keeps the best: fewest crossings and intrusions, then shortest
   * lines. After three structured starts, seeded random starts run while the
   * time budget allows, so the result is the same every time for the same tree.
   */
  private orderRows(): void {
    const original = new Map(this.items.map((item) => [item, [...item.members]]));
    const reset = () => {
      for (const [item, members] of original) this.setMembers(item, [...members]);
    };
    const random = mulberry32(this.items.length * 7919 + this.people.length);
    const hinted = !!this.hint && this.people.some((id) => this.hint!.has(id));
    const size = this.items.length;
    const starts: (() => void)[] = [];
    if (hinted) starts.push(() => this.hintOrder());
    // Big trees get less search: an edit should still feel immediate.
    if (!hinted || size <= 160) {
      starts.push(() => this.initialOrder(false));
      if (size <= 260) {
        starts.push(
          () => this.initialOrder(true),
          () => {
            this.initialOrder(false);
            this.mirror();
          },
        );
      }
    }
    const fixedStarts = starts.length;
    if (!hinted) {
      const randomStarts = size <= 40 ? 16 : size <= 120 ? 6 : size <= 260 ? 2 : 0;
      for (let i = 0; i < randomStarts; i++) starts.push(() => this.randomOrder(random));
    }

    // A safety net for very large trees; normal trees finish well inside it.
    const budgetMs = 400;
    const startedAt = now();
    let best: ReturnType<ComponentLayout['snapshot']> | undefined;
    let bestPenalty = Infinity;
    let bestLength = Infinity;
    let bestCrossings = 0;
    for (let s = 0; s < starts.length; s++) {
      if (s > 0 && bestPenalty === 0 && (hinted || s >= fixedStarts)) break;
      if (s >= fixedStarts && now() - startedAt > budgetMs) break;
      reset();
      starts[s]();
      this.reduceCrossings();
      const penalty = this.crossings + this.countIntrusions();
      const length = this.totalLength();
      // With a hint, the previous order wins ties: only fewer crossings justify a reshuffle.
      const better = penalty < bestPenalty || (penalty === bestPenalty && !(hinted && s > 0) && length < bestLength - 1e-6);
      if (better) {
        bestPenalty = penalty;
        bestLength = length;
        bestCrossings = this.crossings;
        best = this.snapshot();
      }
      if (this.items.length < 3) break;
    }
    if (best) this.restore(best);
    this.crossings = bestCrossings;
  }

  /** Starts from the order of the previous layout; new items go next to their relatives. */
  private hintOrder(): void {
    this.initialOrder(false);
    const hint = this.hint!;
    const ownHint = (item: Item): number | undefined => {
      const xs: number[] = [];
      if (item.kind === 'block')
        for (const m of item.members) {
          const x = hint.get(m);
          if (x !== undefined) xs.push(x);
        }
      if (item.kind === 'dummy' && item.childId) {
        const x = hint.get(item.childId);
        if (x !== undefined) xs.push(x);
      }
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
    };
    const neighbourHint = (item: Item): number | undefined => {
      const xs: number[] = [];
      for (const e of item.up) {
        const x = ownHint(e.upper.item);
        if (x !== undefined) xs.push(x);
      }
      for (const e of item.down) {
        const x = ownHint(e.lower.item);
        if (x !== undefined) xs.push(x);
      }
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
    };
    for (const row of this.rows) {
      const keys = new Map<Item, number>();
      let last = -Infinity;
      for (const item of row) {
        const key = ownHint(item) ?? neighbourHint(item) ?? (Number.isFinite(last) ? last + 1 : -1e9);
        keys.set(item, key);
        last = key;
      }
      row.sort((a, b) => keys.get(a)! - keys.get(b)!);
      this.enforceSiblingOrder(row);
    }
    for (const item of this.items) {
      if (item.members.length < 2) continue;
      const xs = item.members.map((m) => hint.get(m));
      let asc = 0;
      let desc = 0;
      for (let i = 0; i < xs.length; i++) {
        for (let j = i + 1; j < xs.length; j++) {
          const a = xs[i];
          const b = xs[j];
          if (a === undefined || b === undefined) continue;
          if (a < b) asc++;
          else if (a > b) desc++;
        }
      }
      if (desc > asc) this.reverseMembers(item);
    }
    this.packAll();
  }

  private randomOrder(random: () => number): void {
    this.initialOrder(false);
    for (const row of this.rows) {
      for (let i = row.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [row[i], row[j]] = [row[j], row[i]];
      }
      this.enforceSiblingOrder(row);
    }
    for (const item of this.items) if (item.members.length > 1 && random() < 0.5) this.reverseMembers(item);
    this.packAll();
  }

  private mirror(): void {
    for (const row of this.rows) {
      row.reverse();
      this.enforceSiblingOrder(row);
    }
    for (const item of this.items) if (item.members.length > 1) this.reverseMembers(item);
    this.packAll();
  }

  private reverseMembers(item: Item): void {
    item.members.reverse();
    item.jcache = undefined;
  }

  private setMembers(item: Item, members: string[]): void {
    item.members = members;
    item.jcache = undefined;
  }

  private totalLength(): number {
    let total = 0;
    for (const item of this.items) for (const e of item.down) total += Math.abs(this.ax(e.upper) - this.ax(e.lower));
    return total;
  }

  // -- generations ----------------------------------------------------------

  private collectFamilies(): void {
    const inComponent = new Set(this.people);
    for (const f of this.index.doc.families) {
      if (f.partners.some((p) => inComponent.has(p)) || f.children.some((c) => inComponent.has(c.personId))) {
        this.families.push(f);
      }
    }
  }

  private assignRanks(): void {
    const root = this.homeId && this.people.includes(this.homeId) ? this.homeId : this.people[0];
    const rank = this.rank;
    const queue = [root];
    rank.set(root, 0);
    for (const id of queue) {
      const r = rank.get(id)!;
      const visit = (other: string, value: number) => {
        if (!rank.has(other) && this.index.people.has(other)) {
          rank.set(other, value);
          queue.push(other);
        }
      };
      for (const f of this.index.partnerFamilies(id)) {
        for (const p of f.partners) visit(p, r);
        for (const c of f.children) visit(c.personId, r + 1);
      }
      for (const f of this.index.parentFamilies(id)) {
        for (const p of f.partners) visit(p, r - 1);
        for (const c of f.children) visit(c.personId, r);
      }
    }
    for (const id of this.people) if (!rank.has(id)) rank.set(id, 0);

    this.enforceParentOrder();
    for (let round = 0; round < 8; round++) {
      let changed = false;
      for (const f of this.families) {
        if (f.partners.length !== 2) continue;
        const [a, b] = f.partners;
        const ra = rank.get(a);
        const rb = rank.get(b);
        if (ra === undefined || rb === undefined || ra === rb) continue;
        const target = Math.max(ra, rb);
        rank.set(a, target);
        rank.set(b, target);
        changed = true;
      }
      if (!changed) break;
      this.enforceParentOrder();
    }
  }

  /** Pushes children below their parents, in topological order. Loops are ignored. */
  private enforceParentOrder(): void {
    const indegree = new Map<string, number>();
    const kids = new Map<string, string[]>();
    for (const id of this.people) {
      indegree.set(id, 0);
      kids.set(id, []);
    }
    for (const f of this.families) {
      for (const p of f.partners) {
        if (!kids.has(p)) continue;
        for (const c of f.children) {
          if (!indegree.has(c.personId) || c.personId === p) continue;
          kids.get(p)!.push(c.personId);
          indegree.set(c.personId, indegree.get(c.personId)! + 1);
        }
      }
    }
    const queue = this.people.filter((id) => indegree.get(id) === 0);
    for (const id of queue) {
      const r = this.rank.get(id)!;
      for (const c of kids.get(id)!) {
        if (this.rank.get(c)! < r + 1) this.rank.set(c, r + 1);
        const d = indegree.get(c)! - 1;
        indegree.set(c, d);
        if (d === 0) queue.push(c);
      }
    }
  }

  private classifyLinks(): void {
    for (const f of this.families) {
      f.children.forEach((c, i) => {
        if (!this.index.people.has(c.personId)) return;
        const link: ChildLink = { family: f, childId: c.personId, relation: c.relation, siblingIndex: i };
        if (this.index.primaryParentFamily(c.personId)?.id === f.id) {
          this.primaryFamilyOf.set(c.personId, f.id);
          this.primary.push(link);
        } else {
          this.secondary.push(link);
        }
      });
    }
    // Families without known parents hang from a placeholder one row above the children.
    for (const f of this.families) {
      if (f.partners.length) continue;
      const kids = this.primary.filter((l) => l.family === f);
      if (!kids.length) continue;
      this.placeholderRank.set(f.id, Math.min(...kids.map((k) => this.rank.get(k.childId)!)) - 1);
    }
    // A primary link must point downwards; anything else (a loop in the data) is drawn as a plain link.
    for (let i = this.primary.length - 1; i >= 0; i--) {
      const link = this.primary[i];
      if (this.rank.get(link.childId)! <= this.junctionRank(link.family)) {
        this.primary.splice(i, 1);
        this.primaryFamilyOf.delete(link.childId);
        this.secondary.push(link);
      }
    }
    for (const link of this.primary) {
      const list = this.primaryByFamily.get(link.family.id) ?? [];
      list.push(link);
      this.primaryByFamily.set(link.family.id, list);
    }
  }

  private normalizeRanks(): void {
    let min = Infinity;
    for (const r of this.rank.values()) min = Math.min(min, r);
    for (const r of this.placeholderRank.values()) min = Math.min(min, r);
    if (!Number.isFinite(min) || min === 0) return;
    for (const [k, r] of this.rank) this.rank.set(k, r - min);
    for (const [k, r] of this.placeholderRank) this.placeholderRank.set(k, r - min);
  }

  junctionRank(f: Family): number {
    if (!f.partners.length) return this.placeholderRank.get(f.id) ?? 0;
    let r = -Infinity;
    for (const p of f.partners) r = Math.max(r, this.rank.get(p) ?? 0);
    return r;
  }

  // -- items ----------------------------------------------------------------

  private newItem(kind: ItemKind, rank: number, width: number, order: number): Item {
    const item: Item = { uid: this.uid++, kind, rank, members: [], width, x: 0, up: [], down: [], order };
    this.items.push(item);
    return item;
  }

  private buildBlocks(): void {
    const byRank = new Map<number, string[]>();
    for (const id of this.people) {
      const r = this.rank.get(id)!;
      const list = byRank.get(r) ?? [];
      list.push(id);
      byRank.set(r, list);
    }
    for (const [r, ids] of byRank) {
      const parent = new Map(ids.map((id) => [id, id]));
      const find = (x: string): string => {
        let root = x;
        while (parent.get(root) !== root) root = parent.get(root)!;
        let cur = x;
        while (parent.get(cur) !== root) {
          const next = parent.get(cur)!;
          parent.set(cur, root);
          cur = next;
        }
        return root;
      };
      const adjacency = new Map<string, string[]>();
      for (const id of ids) {
        for (const f of this.index.partnerFamilies(id)) {
          if (f.partners.length !== 2) continue;
          const other = f.partners[0] === id ? f.partners[1] : f.partners[0];
          if (this.rank.get(other) !== r) continue;
          const list = adjacency.get(id) ?? [];
          if (!list.includes(other)) list.push(other);
          adjacency.set(id, list);
          parent.set(find(id), find(other));
        }
      }
      const groups = new Map<string, string[]>();
      for (const id of ids) {
        const root = find(id);
        const list = groups.get(root) ?? [];
        list.push(id);
        groups.set(root, list);
      }
      for (const group of groups.values()) {
        group.sort((a, b) => this.index.order(a) - this.index.order(b));
        const members = arrangeBlock(group, adjacency);
        const width = members.reduce((sum, m) => sum + this.widthOf(m), 0) + (members.length - 1) * this.Gp;
        const item = this.newItem('block', r, width, this.index.order(group[0]));
        item.members = members;
        for (const m of members) this.blockOf.set(m, item);
      }
    }
  }

  private buildPlaceholders(): void {
    for (const [familyId, r] of this.placeholderRank) {
      const item = this.newItem('placeholder', r, this.o.placeholderRadius * 2, 1e6 + this.index.familyIndex(familyId));
      item.familyId = familyId;
      this.placeholderOf.set(familyId, item);
    }
  }

  junctionItem(f: Family): Item | undefined {
    if (!f.partners.length) return this.placeholderOf.get(f.id);
    let deepest: string | undefined;
    for (const p of f.partners) {
      if (!this.blockOf.has(p)) continue;
      if (deepest === undefined || this.rank.get(p)! > this.rank.get(deepest)!) deepest = p;
    }
    return deepest ? this.blockOf.get(deepest) : undefined;
  }

  junctionAnchor(f: Family): Anchor | undefined {
    const item = this.junctionItem(f);
    if (!item) return undefined;
    return item.kind === 'placeholder' ? { kind: 'center', item } : { kind: 'junction', item, family: f };
  }

  private buildEdges(): void {
    for (const link of this.primary) {
      const upper = this.junctionAnchor(link.family);
      const childItem = this.blockOf.get(link.childId);
      if (!upper || !childItem) continue;
      const jr = upper.item.rank;
      const cr = childItem.rank;
      const chain: Item[] = [];
      for (let r = jr + 1; r < cr; r++) {
        const d = this.newItem('dummy', r, DUMMY_WIDTH, 2e6 + this.index.familyIndex(link.family.id));
        d.familyId = link.family.id;
        d.childId = link.childId;
        chain.push(d);
      }
      if (chain.length) this.chains.set(chainKey(link.family.id, link.childId), chain);
      let prev: Anchor = upper;
      for (const d of chain) {
        const next: Anchor = { kind: 'center', item: d };
        this.addEdge(prev, next, link);
        prev = next;
      }
      this.addEdge(prev, { kind: 'member', item: childItem, personId: link.childId }, link);
    }
  }

  private addEdge(upper: Anchor, lower: Anchor, link: ChildLink): void {
    const weight = upper.item.kind === 'dummy' || lower.item.kind === 'dummy' ? 3 : 1;
    const e: Edge = { upper, lower, familyId: link.family.id, childId: link.childId, siblingIndex: link.siblingIndex, weight };
    upper.item.down.push(e);
    lower.item.up.push(e);
    if (upper.kind !== 'center' || upper.item.kind === 'placeholder') {
      // The item right below a family is one of its "sibling slots".
      const tags = this.siblingTags.get(lower.item) ?? [];
      tags.push({ familyId: link.family.id, index: link.siblingIndex });
      this.siblingTags.set(lower.item, tags);
    }
  }

  /** For each item directly below a family: which family and which child it is. */
  private readonly siblingTags = new Map<Item, { familyId: string; index: number }[]>();

  /**
   * Children are drawn in birth order (the order the family lists them). The
   * order may run right to left when that avoids crossings: when both partners
   * of a couple are the eldest in their families, one family has to read the
   * other way. The positions a family's children occupy are re-filled in
   * whichever direction is closer to the current arrangement.
   */
  private enforceSiblingOrder(row: Item[]): void {
    const groups = new Map<string, { pos: number; index: number }[]>();
    row.forEach((item, pos) => {
      for (const tag of this.siblingTags.get(item) ?? []) {
        const list = groups.get(tag.familyId) ?? [];
        list.push({ pos, index: tag.index });
        groups.set(tag.familyId, list);
      }
    });
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      let ascending = 0;
      let descending = 0;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[i].index < list[j].index) ascending++;
          else if (list[i].index > list[j].index) descending++;
        }
      }
      const dir = descending > ascending ? -1 : 1;
      const sorted = [...list].sort((a, b) => (a.index - b.index) * dir);
      if (sorted.every((s, i) => s.pos === list[i].pos)) continue;
      const items = sorted.map((s) => row[s.pos]);
      list.forEach((slot, i) => (row[slot.pos] = items[i]));
    }
  }

  // -- geometry helpers -----------------------------------------------------

  ax(a: Anchor): number {
    return a.item.x + this.offset(a);
  }

  offset(a: Anchor): number {
    switch (a.kind) {
      case 'center':
        return a.item.width / 2;
      case 'member':
        return this.memberOffset(a.item, a.personId);
      case 'junction':
        return this.junctionOffset(a.item, a.family);
    }
  }

  memberOffset(item: Item, personId: string): number {
    const i = Math.max(0, item.members.indexOf(personId));
    return this.memberLeft(item, i) + this.widthOf(item.members[i]) / 2;
  }

  /** Index of the gap (between member g and g + 1) holding a couple's marker, or -1. */
  junctionGap(item: Item, f: Family): number {
    if (f.partners.length !== 2) return -1;
    const i = item.members.indexOf(f.partners[0]);
    const j = item.members.indexOf(f.partners[1]);
    if (i < 0 || j < 0) return -1;
    const lo = Math.min(i, j);
    const hi = Math.max(i, j);
    if (hi === lo + 1) return lo;
    const used = new Set<number>();
    for (let g = 0; g + 1 < item.members.length; g++) {
      if (this.index.familyBetween(item.members[g], item.members[g + 1])) used.add(g);
    }
    if (!used.has(hi - 1)) return hi - 1;
    if (!used.has(lo)) return lo;
    return hi - 1;
  }

  junctionOffset(item: Item, f: Family): number {
    const cached = item.jcache?.get(f.id);
    if (cached !== undefined) return cached;
    const value = this.computeJunctionOffset(item, f);
    (item.jcache ??= new Map()).set(f.id, value);
    return value;
  }

  private computeJunctionOffset(item: Item, f: Family): number {
    const g = this.junctionGap(item, f);
    if (g >= 0) return this.memberLeft(item, g) + this.widthOf(item.members[g]) + this.Gp / 2;
    const inBlock = f.partners.filter((p) => item.members.includes(p));
    if (inBlock.length) {
      let deepest = inBlock[0];
      for (const p of inBlock) if (this.rank.get(p)! > this.rank.get(deepest)!) deepest = p;
      return this.memberOffset(item, deepest);
    }
    return item.width / 2;
  }

  private gap(a: Item, b: Item): number {
    if (a.kind === 'dummy' || b.kind === 'dummy') return Math.round(this.o.siblingGap * 0.75);
    if (a.kind === 'placeholder' || b.kind === 'placeholder') return Math.round(this.o.familyGap * 0.75);
    return this.areSiblings(a, b) ? this.o.siblingGap : this.o.familyGap;
  }

  private areSiblings(a: Item, b: Item): boolean {
    for (const m of a.members) {
      const fa = this.primaryFamilyOf.get(m);
      if (!fa) continue;
      for (const n of b.members) if (this.primaryFamilyOf.get(n) === fa) return true;
    }
    return false;
  }

  private pack(row: Item[]): void {
    let x = 0;
    for (let i = 0; i < row.length; i++) {
      row[i].x = x;
      x += row[i].width + (i + 1 < row.length ? this.gap(row[i], row[i + 1]) : 0);
    }
    const shift = -x / 2;
    for (const item of row) item.x += shift;
  }

  private packAll(): void {
    for (const row of this.rows) this.pack(row);
  }

  // -- ordering -------------------------------------------------------------

  private initialOrder(reverseChildren: boolean): void {
    const key = new Map<Item, number>();
    let n = 0;
    const roots = [...this.items].sort((a, b) => a.rank - b.rank || a.order - b.order);
    for (const root of roots) {
      if (key.has(root)) continue;
      const stack: Item[] = [root];
      while (stack.length) {
        const item = stack.pop()!;
        if (key.has(item)) continue;
        key.set(item, n++);
        const next: Item[] = [];
        const downs = [...item.down].sort((a, b) => this.offset(a.upper) - this.offset(b.upper) || a.siblingIndex - b.siblingIndex);
        if (reverseChildren) downs.reverse();
        for (const e of downs) next.push(e.lower.item);
        const ups = [...item.up].sort((a, b) => this.offset(a.lower) - this.offset(b.lower));
        for (const e of ups) next.push(e.upper.item);
        for (let i = next.length - 1; i >= 0; i--) if (!key.has(next[i])) stack.push(next[i]);
      }
    }
    const depth = Math.max(0, ...this.items.map((i) => i.rank)) + 1;
    this.rows = Array.from({ length: depth }, () => []);
    for (const item of this.items) this.rows[item.rank].push(item);
    for (const row of this.rows) {
      row.sort((a, b) => key.get(a)! - key.get(b)!);
      this.enforceSiblingOrder(row);
    }
    this.packAll();
  }

  private sortRow(r: number, dir: 'up' | 'down'): void {
    const row = this.rows[r];
    const keys = new Map<Item, number>();
    for (const item of row) {
      // Items with no links in the sweep direction follow their links in the other
      // direction, so in-laws' parents move towards their child instead of staying
      // wedged between someone else's siblings.
      let useUp = dir === 'up';
      if (useUp && !item.up.length && item.down.length) useUp = false;
      else if (!useUp && !item.down.length && item.up.length) useUp = true;
      const edges = useUp ? item.up : item.down;
      if (!edges.length) {
        keys.set(item, item.x + item.width / 2);
        continue;
      }
      let sum = 0;
      let minSibling = Infinity;
      for (const e of edges) {
        sum += this.ax(useUp ? e.upper : e.lower);
        minSibling = Math.min(minSibling, e.siblingIndex);
      }
      keys.set(item, sum / edges.length + (useUp ? minSibling * 1e-3 : 0));
    }
    row.sort((a, b) => keys.get(a)! - keys.get(b)!);
    this.enforceSiblingOrder(row);
    this.pack(row);
  }

  private blockCost(item: Item): number {
    let c = 0;
    for (const e of item.up) c += Math.abs(this.ax(e.upper) - this.ax(e.lower));
    for (const e of item.down) c += Math.abs(this.ax(e.lower) - this.ax(e.upper));
    return c;
  }

  private flipBlocks(): void {
    for (const item of this.items) {
      if (item.kind !== 'block' || item.members.length < 2) continue;
      const before = this.blockCost(item);
      this.reverseMembers(item);
      if (this.blockCost(item) >= before - 0.5) this.reverseMembers(item);
    }
  }

  private pairCrossings(left: Item, right: Item): number {
    let c = 0;
    for (const a of left.up) for (const b of right.up) if (this.ax(a.upper) > this.ax(b.upper) + 0.01) c++;
    for (const a of left.down) for (const b of right.down) if (this.ax(a.lower) > this.ax(b.lower) + 0.01) c++;
    return c;
  }

  private transpose(): void {
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      for (const row of this.rows) {
        for (let i = 0; i + 1 < row.length; i++) {
          const u = row[i];
          const v = row[i + 1];
          if (this.pairCrossings(v, u) < this.pairCrossings(u, v)) {
            row[i] = v;
            row[i + 1] = u;
            // Swapping siblings is only kept if birth order still reads one way.
            if (this.shareFamily(u, v)) this.enforceSiblingOrder(row);
            this.pack(row);
            if (row[i] === v) improved = true;
          }
        }
      }
      if (!improved) break;
    }
  }

  private shareFamily(a: Item, b: Item): boolean {
    const ta = this.siblingTags.get(a);
    const tb = this.siblingTags.get(b);
    if (!ta || !tb) return false;
    return ta.some((x) => tb.some((y) => y.familyId === x.familyId));
  }

  countCrossings(): number {
    let total = 0;
    for (let r = 0; r < this.edgesByRank.length; r++) total += this.crossingsAt(r);
    return total;
  }

  /** Crossings between the links leaving row r and arriving in row r + 1. */
  private crossingsAt(r: number): number {
    const edges = this.edgesByRank[r];
    if (!edges || edges.length < 2) return 0;
    const n = edges.length;
    const xu = new Float64Array(n);
    const xl = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xu[i] = this.ax(edges[i].upper);
      xl[i] = this.ax(edges[i].lower);
    }
    if (n < 40) {
      let c = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if ((xu[i] - xu[j]) * (xl[i] - xl[j]) < -0.01) c++;
      return c;
    }
    // Sort by the upper end, then count inversions of the lower end (merge sort).
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => xu[a] - xu[b] || xl[a] - xl[b]);
    const values = Float64Array.from(order, (i) => xl[i]);
    return countInversions(values, new Float64Array(n), 0, n);
  }

  private snapshot(): { rows: Item[][]; members: Map<Item, string[]> } {
    const members = new Map<Item, string[]>();
    for (const item of this.items) if (item.members.length > 1) members.set(item, [...item.members]);
    return { rows: this.rows.map((r) => [...r]), members };
  }

  private restore(s: { rows: Item[][]; members: Map<Item, string[]> }): void {
    this.rows = s.rows.map((r) => [...r]);
    for (const [item, m] of s.members) this.setMembers(item, [...m]);
    this.packAll();
  }

  /**
   * Counts people who sit under another family's sibling bar without belonging
   * to it. Such a bar reads as if they were children of that family.
   */
  countIntrusions(): number {
    let total = 0;
    for (let r = 0; r < this.spansByRank.length; r++) total += this.intrusionsAt(r);
    return total;
  }

  private intrusionsAt(rank: number): number {
    const spans = this.spansByRank[rank];
    const row = this.rows[rank];
    if (!spans || !row?.length) return 0;
    let total = 0;
    for (const span of spans) {
      let lo = this.ax(span.upper);
      let hi = lo;
      for (const o of span.own) {
        const x = o.personId ? o.item.x + this.memberOffset(o.item, o.personId) : o.item.x + o.item.width / 2;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
      if (hi - lo < 2) continue;
      // Rows are ordered left to right, so find the first item that reaches into the span.
      let a = 0;
      let b = row.length;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (row[mid].x + row[mid].width > lo + 1) b = mid;
        else a = mid + 1;
      }
      for (let k = a; k < row.length && row[k].x < hi - 1; k++) if (!span.ownSet.has(row[k])) total++;
    }
    return total;
  }

  private orderScore(): number {
    return this.countCrossings() + this.countIntrusions();
  }

  /** The part of the score a change inside row r can affect. */
  private localScore(r: number): number {
    return this.crossingsAt(r - 1) + this.crossingsAt(r) + this.intrusionsAt(r) + this.intrusionsAt(r + 1);
  }

  /** Moves people out from between siblings who are not theirs, when that helps. */
  private unintrude(): void {
    const rounds = this.items.length > 300 ? 1 : this.items.length > 120 ? 2 : 4;
    for (let round = 0; round < rounds; round++) {
      let improved = false;
      for (const span of this.spans) {
        const rank = span.rank;
        const row = this.rows[rank];
        if (!row) continue;
        let first = -1;
        let last = -1;
        row.forEach((item, i) => {
          if (span.ownSet.has(item)) {
            if (first < 0) first = i;
            last = i;
          }
        });
        if (first < 0 || last - first < 2) continue;
        for (let i = first + 1; i < last; i++) {
          const intruder = row[i];
          if (span.ownSet.has(intruder)) continue;
          const base = this.localScore(rank);
          let bestScore = base;
          let bestRow: Item[] | undefined;
          for (const to of [first, last]) {
            const candidate = row.filter((x) => x !== intruder);
            const at = to === first ? candidate.indexOf(row[first]) : candidate.indexOf(row[last]) + 1;
            candidate.splice(at, 0, intruder);
            this.enforceSiblingOrder(candidate);
            this.rows[rank] = candidate;
            this.pack(candidate);
            const score = this.localScore(rank);
            if (score < bestScore) {
              bestScore = score;
              bestRow = candidate;
            }
          }
          this.rows[rank] = bestRow ?? row;
          this.pack(this.rows[rank]);
          if (bestRow) {
            improved = true;
            break;
          }
        }
      }
      if (!improved) break;
    }
  }

  private reduceCrossings(): void {
    let best = this.snapshot();
    let bestScore = this.orderScore();
    const sweeps = this.items.length > 300 ? 8 : this.items.length > 150 ? 12 : 20;
    for (let iter = 0; iter < sweeps && bestScore > 0; iter++) {
      if (iter % 2 === 0) for (let r = 1; r < this.rows.length; r++) this.sortRow(r, 'up');
      else for (let r = this.rows.length - 2; r >= 0; r--) this.sortRow(r, 'down');
      this.flipBlocks();
      this.transpose();
      const score = this.orderScore();
      if (score < bestScore) {
        bestScore = score;
        best = this.snapshot();
      }
    }
    this.restore(best);
    this.unintrude();
    best = this.snapshot();
    bestScore = this.orderScore();
    this.flipBlocks();
    if (this.orderScore() > bestScore) this.restore(best);
    this.crossings = this.countCrossings();
  }

  // -- positions ------------------------------------------------------------

  private place(): void {
    this.packAll();
    const R = this.rows.length;
    // Warm-up: alternately centre children under parents and parents over children.
    for (let it = 0; it < 8; it++) {
      for (let r = 1; r < R; r++) this.placeRow(r, 'up');
      for (let r = R - 2; r >= 0; r--) this.placeRow(r, 'down');
    }
    // Then settle every link like a spring (projected over-relaxation; each row
    // step is an exact constrained solve, so this converges), and finish plain.
    const big = this.items.length > 300;
    this.relax(big ? 240 : 600, 1.6);
    this.relax(big ? 80 : 300, 1);
    // Couples that ended up facing the wrong way are flipped, then settled again.
    if (this.flipPlacedBlocks()) {
      this.relax(big ? 160 : 600, 1.6);
      this.relax(big ? 60 : 300, 1);
    }
  }

  private edgesByRank: Edge[][] = [];

  private relax(iterations: number, omega: number): void {
    const R = this.rows.length;
    for (let it = 0; it < iterations; it++) {
      let moved = 0;
      for (let r = 0; r < R; r++) moved = Math.max(moved, this.placeRow(r, 'spring', omega));
      for (let r = R - 1; r >= 0; r--) moved = Math.max(moved, this.placeRow(r, 'spring', omega));
      if (moved < 0.01) break;
    }
  }

  private crosses(e: Edge, f: Edge): boolean {
    return (this.ax(e.upper) - this.ax(f.upper)) * (this.ax(e.lower) - this.ax(f.lower)) < -0.01;
  }

  private incidentCrossings(item: Item): number {
    let c = 0;
    const above = this.edgesByRank[item.rank - 1] ?? [];
    for (const e of item.up) for (const f of above) if (f !== e && f.lower.item !== item && this.crosses(e, f)) c++;
    const below = this.edgesByRank[item.rank] ?? [];
    for (const e of item.down) for (const f of below) if (f !== e && f.upper.item !== item && this.crosses(e, f)) c++;
    return c;
  }

  private flipPlacedBlocks(): boolean {
    let any = false;
    for (const item of this.items) {
      if (item.kind !== 'block' || item.members.length < 2) continue;
      const cost = this.blockCost(item);
      const crossings = this.incidentCrossings(item);
      this.reverseMembers(item);
      if (this.blockCost(item) < cost - 1 && this.incidentCrossings(item) <= crossings) any = true;
      else this.reverseMembers(item);
    }
    return any;
  }

  /**
   * The best x for an item if every link were a spring: the weighted mean of
   * where each link wants it. Weights are the same seen from both ends, so the
   * row-by-row solves minimise one shared energy and settle.
   */
  private springDesire(item: Item): { x: number; w: number } | null {
    let s = 0;
    let w = 0;
    for (const e of item.up) {
      s += (this.ax(e.upper) - this.offset(e.lower)) * e.weight;
      w += e.weight;
    }
    for (const e of item.down) {
      s += (this.ax(e.lower) - this.offset(e.upper)) * e.weight;
      w += e.weight;
    }
    return w ? { x: s / w, w } : null;
  }

  private upDesire(item: Item): { x: number; w: number } | null {
    let s = 0;
    let w = 0;
    for (const e of item.up) {
      s += (this.ax(e.upper) - this.offset(e.lower)) * e.weight;
      w += e.weight;
    }
    return w ? { x: s / w, w } : null;
  }

  private downDesire(item: Item): { x: number; w: number } | null {
    if (!item.down.length) return null;
    const groups = new Map<string, Edge[]>();
    for (const e of item.down) {
      const list = groups.get(e.familyId) ?? [];
      list.push(e);
      groups.set(e.familyId, list);
    }
    let s = 0;
    let w = 0;
    for (const edges of groups.values()) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const e of edges) {
        const x = this.ax(e.lower);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      s += ((lo + hi) / 2 - this.offset(edges[0].upper)) * edges.length;
      w += edges.length;
    }
    return { x: s / w, w };
  }

  /** Re-positions one row; returns the largest distance an item moved. */
  private placeRow(r: number, mode: 'up' | 'down' | 'spring', omega = 1): number {
    const row = this.rows[r];
    const n = row.length;
    if (!n) return 0;
    const target: number[] = new Array(n);
    const weight: number[] = new Array(n);
    const sep: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const item = row[i];
      const desire = mode === 'up' ? this.upDesire(item) : mode === 'down' ? this.downDesire(item) : this.springDesire(item);
      if (desire) {
        target[i] = item.x + omega * (desire.x - item.x);
        weight[i] = desire.w;
      } else {
        target[i] = item.x;
        weight[i] = 0.02;
      }
      sep[i] = i + 1 < n ? item.width + this.gap(item, row[i + 1]) : 0;
    }
    const xs = isotonic(target, weight, sep);
    let moved = 0;
    for (let i = 0; i < n; i++) {
      moved = Math.max(moved, Math.abs(row[i].x - xs[i]));
      row[i].x = xs[i];
    }
    return moved;
  }

  // -- extents --------------------------------------------------------------

  minX(): number {
    let m = Infinity;
    for (const item of this.items) m = Math.min(m, item.x);
    return Number.isFinite(m) ? m : 0;
  }

  maxX(): number {
    let m = -Infinity;
    for (const item of this.items) m = Math.max(m, item.x + item.width);
    return Number.isFinite(m) ? m : 0;
  }

  shift(dx: number): void {
    for (const item of this.items) item.x += dx;
  }
}

/**
 * Orders the partners of one row so that each sits next to the person they are
 * with. The person with most partners goes in the middle; their partners, in
 * the order the relationships began, go right, left, then further out on each
 * side. Partners of partners go outside the partner they are with.
 */
function arrangeBlock(group: string[], adjacency: Map<string, string[]>): string[] {
  if (group.length === 1) return group;
  let center = group[0];
  for (const id of group) {
    if ((adjacency.get(id)?.length ?? 0) > (adjacency.get(center)?.length ?? 0)) center = id;
  }
  const line = [center];
  const placed = new Set([center]);
  const queue = [center];
  let toRight = true;
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of adjacency.get(u) ?? []) {
      if (placed.has(v)) continue;
      if (u === center) {
        // The centre's partners are placed first, so the ends of the line are free.
        if (toRight) line.push(v);
        else line.unshift(v);
        toRight = !toRight;
      } else {
        const iu = line.indexOf(u);
        const right = iu > line.indexOf(center);
        line.splice(right ? iu + 1 : iu, 0, v);
      }
      placed.add(v);
      queue.push(v);
    }
  }
  for (const id of group) if (!placed.has(id)) line.push(id);
  return line;
}

/**
 * Weighted isotonic regression with spacing: finds x minimising
 * sum w_i (x_i - t_i)^2 subject to x_{i+1} >= x_i + sep_i.
 */
export function isotonic(target: number[], weight: number[], sep: number[]): number[] {
  const n = target.length;
  const offs = new Array<number>(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    offs[i] = acc;
    acc += sep[i] ?? 0;
  }
  const value: number[] = [];
  const wsum: number[] = [];
  const start: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = target[i] - offs[i];
    let w = Math.max(weight[i], 1e-9);
    let s = i;
    while (value.length && value[value.length - 1] > v) {
      const pv = value.pop()!;
      const pw = wsum.pop()!;
      s = start.pop()!;
      v = (pv * pw + v * w) / (pw + w);
      w += pw;
    }
    value.push(v);
    wsum.push(w);
    start.push(s);
  }
  const out = new Array<number>(n);
  for (let b = 0; b < value.length; b++) {
    const end = b + 1 < value.length ? start[b + 1] : n;
    for (let i = start[b]; i < end; i++) out[i] = value[b] + offs[i];
  }
  return out;
}

/** Counts pairs i < j with a[i] > a[j] in a[lo, hi), sorting it as a side effect. */
function countInversions(a: Float64Array, tmp: Float64Array, lo: number, hi: number): number {
  if (hi - lo < 2) return 0;
  const mid = (lo + hi) >> 1;
  let count = countInversions(a, tmp, lo, mid) + countInversions(a, tmp, mid, hi);
  let i = lo;
  let j = mid;
  let k = lo;
  while (i < mid && j < hi) {
    if (a[j] < a[i] - 0.01) {
      count += mid - i;
      tmp[k++] = a[j++];
    } else {
      tmp[k++] = a[i++];
    }
  }
  while (i < mid) tmp[k++] = a[i++];
  while (j < hi) tmp[k++] = a[j++];
  for (let t = lo; t < hi; t++) a[t] = tmp[t];
  return count;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function chainKey(familyId: string, childId: string): string {
  return `${familyId}|${childId}`;
}

function assignTracks(intervals: Interval[]): { track: Map<string, number>; count: number } {
  const sorted = [...intervals].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  const ends: number[] = [];
  const track = new Map<string, number>();
  for (const iv of sorted) {
    let t = ends.findIndex((end) => end + BAR_SEPARATION <= iv.lo);
    if (t < 0) {
      t = ends.length;
      ends.push(iv.hi);
    } else {
      ends[t] = iv.hi;
    }
    track.set(iv.key, t);
  }
  return { track, count: ends.length };
}

// ---------------------------------------------------------------------------

function assemble(parts: ComponentLayout[], o: LayoutOptions): LayoutResult {
  const H = o.cardHeight;
  const R = Math.max(0, ...parts.map((p) => p.rows.length));

  // Horizontal extents of every bar and jog, per gap below a row.
  const gaps: Interval[][] = Array.from({ length: R }, () => []);
  for (const part of parts) {
    for (const [familyId, links] of part.primaryByFamily) {
      const family = links[0].family;
      const upper = part.junctionAnchor(family);
      if (!upper) continue;
      const xs = [part.ax(upper)];
      for (const link of links) {
        const chain = part.chains.get(chainKey(familyId, link.childId));
        const childItem = part.blockOf.get(link.childId);
        if (chain) xs.push(chain[0].x + chain[0].width / 2);
        else if (childItem) xs.push(childItem.x + part.memberOffset(childItem, link.childId));
        if (chain) {
          for (let k = 0; k < chain.length; k++) {
            const from = chain[k].x + chain[k].width / 2;
            const to =
              k + 1 < chain.length ? chain[k + 1].x + chain[k + 1].width / 2 : childItem ? childItem.x + part.memberOffset(childItem, link.childId) : from;
            if (Math.abs(from - to) > 0.5) {
              gaps[chain[k].rank].push({ lo: Math.min(from, to), hi: Math.max(from, to), key: `jog:${chainKey(familyId, link.childId)}:${chain[k].rank}` });
            }
          }
        }
      }
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      if (hi - lo > 0.5) gaps[upper.item.rank].push({ lo, hi, key: `bar:${familyId}` });
    }
  }
  // A row that only holds "unknown parents" markers is drawn short and gets no generation number.
  const hasCards: boolean[] = new Array(R).fill(false);
  const hasMarkers: boolean[] = new Array(R).fill(false);
  for (const part of parts) {
    for (const item of part.items) {
      if (item.kind === 'block') hasCards[item.rank] = true;
      else if (item.kind === 'placeholder') hasMarkers[item.rank] = true;
    }
  }
  const rowH = hasCards.map((cards, r) => (cards ? H : hasMarkers[r] ? o.placeholderRadius * 2 + 4 : 0));
  const tracks = gaps.map((list) => assignTracks(list));
  const gapHeight = tracks.map((t, r) => (hasCards[r] ? o.rowGap : Math.round(o.rowGap * 0.6)) + Math.max(0, t.count - 1) * o.trackGap);
  const rowY: number[] = [0];
  for (let r = 0; r < R; r++) rowY[r + 1] = rowY[r] + rowH[r] + gapHeight[r];

  const lineY = (rank: number, key: string): number => {
    const t = tracks[rank];
    const count = Math.max(1, t?.count ?? 1);
    const index = t?.track.get(key) ?? (count - 1) / 2;
    return rowY[rank] + rowH[rank] + gapHeight[rank] / 2 + (index - (count - 1) / 2) * o.trackGap;
  };

  const cards: LayoutCard[] = [];
  const placeholders: LayoutPlaceholder[] = [];
  const unions: LayoutUnion[] = [];
  const connectors: LayoutConnector[] = [];
  const links: LayoutLink[] = [];
  const ranks = new Map<string, number>();
  const cardOf = new Map<string, LayoutCard>();

  for (const part of parts) {
    for (const item of part.items) {
      if (item.kind === 'block') {
        item.members.forEach((id, i) => {
          const card: LayoutCard = { personId: id, x: item.x + part.memberLeft(item, i), y: rowY[item.rank], w: part.widthOf(id), h: H, rank: item.rank };
          cards.push(card);
          cardOf.set(id, card);
          ranks.set(id, item.rank);
        });
      } else if (item.kind === 'placeholder') {
        placeholders.push({
          familyId: item.familyId!,
          cx: item.x + item.width / 2,
          cy: rowY[item.rank] + rowH[item.rank] / 2,
          r: o.placeholderRadius,
          rank: item.rank,
        });
      }
    }
  }

  for (const part of parts) {
    const bridgesInBlock = new Map<Item, number>();
    const stemOf = new Map<string, { stem: Pt; clearY: number }>();
    for (const f of part.families) {
      const union = buildUnion(part, f, cardOf, o, bridgesInBlock, rowY, rowH);
      if (!union) continue;
      unions.push(union);
      const stem: Pt =
        union.mode === 'gap' || union.mode === 'bridge'
          ? { x: union.cx, y: union.cy + o.junctionRadius }
          : union.mode === 'none'
            ? { x: union.cx, y: union.cy + o.placeholderRadius }
            : { x: union.cx, y: union.cy };
      // The stem of a couple starts between their cards; lines turn towards the children only below the row.
      const clearY = rowY[union.rank] + rowH[union.rank];
      stemOf.set(f.id, { stem, clearY });
      const primary = part.primaryByFamily.get(f.id);
      if (!primary?.length) continue;
      const drops: LayoutDrop[] = [];
      for (const link of primary) {
        const card = cardOf.get(link.childId);
        if (!card) continue;
        const target: Pt = { x: card.x + card.w / 2, y: card.y };
        const chain = part.chains.get(chainKey(f.id, link.childId));
        if (!chain) {
          drops.push({ childId: link.childId, relation: link.relation, x: target.x, points: [target] });
          continue;
        }
        const points: Pt[] = [];
        let x = chain[0].x + chain[0].width / 2;
        const startX = x;
        for (let k = 0; k < chain.length; k++) {
          const nextX = k + 1 < chain.length ? chain[k + 1].x + chain[k + 1].width / 2 : target.x;
          const y = lineY(chain[k].rank, `jog:${chainKey(f.id, link.childId)}:${chain[k].rank}`);
          points.push({ x, y });
          if (Math.abs(nextX - x) > 0.5) points.push({ x: nextX, y });
          x = nextX;
        }
        points.push(target);
        drops.push({ childId: link.childId, relation: link.relation, x: startX, points });
      }
      if (drops.length) {
        connectors.push({ familyId: f.id, stem, clearY, barY: lineY(union.rank, `bar:${f.id}`), drops });
      }
    }
    for (const link of part.secondary) {
      const from = stemOf.get(link.family.id);
      const card = cardOf.get(link.childId);
      if (!from || !card) continue;
      links.push({
        familyId: link.family.id,
        childId: link.childId,
        relation: link.relation,
        from: from.stem,
        clearY: from.clearY,
        to: { x: card.x + card.w / 2, y: card.y },
      });
    }
  }

  const rows: LayoutRow[] = [];
  let generation = 0;
  for (let r = 0; r < R; r++) {
    if (hasCards[r]) rows.push({ rank: r, y: rowY[r], h: H, label: toRoman(++generation) });
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const extend = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const c of cards) {
    extend(c.x, c.y);
    extend(c.x + c.w, c.y + c.h);
  }
  for (const p of placeholders) {
    extend(p.cx - p.r, p.cy - p.r);
    extend(p.cx + p.r, p.cy + p.r);
  }
  for (const u of unions) for (const pt of u.line) extend(pt.x, pt.y);
  const bounds = Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : { x: 0, y: 0, w: 0, h: 0 };

  const crossings = parts.reduce((sum, p) => sum + p.crossings, 0);
  return { cards, placeholders, unions, connectors, links, rows, bounds, ranks, crossings };
}

function buildUnion(
  part: ComponentLayout,
  f: Family,
  cardOf: Map<string, LayoutCard>,
  o: LayoutOptions,
  bridgesInBlock: Map<Item, number>,
  rowY: number[],
  rowH: number[],
): LayoutUnion | undefined {
  const H = o.cardHeight;
  const ended = !!f.end?.reason && ENDED_REASONS.has(f.end.reason);
  const base = { familyId: f.id, kind: f.kind, ended };
  const hasChildren = (part.primaryByFamily.get(f.id)?.length ?? 0) > 0 || part.secondary.some((l) => l.family === f);

  if (f.partners.length === 0) {
    const item = part.placeholderOf.get(f.id);
    if (!item) return undefined;
    return { ...base, mode: 'none', cx: item.x + item.width / 2, cy: rowY[item.rank] + rowH[item.rank] / 2, line: [], rank: item.rank };
  }

  const partnerCards = f.partners.map((p) => cardOf.get(p)).filter((c): c is LayoutCard => !!c);
  if (partnerCards.length === 1) {
    if (!hasChildren) return undefined;
    const c = partnerCards[0];
    return { ...base, mode: 'single', cx: c.x + c.w / 2, cy: c.y + H, line: [], rank: c.rank };
  }
  if (partnerCards.length !== 2) return undefined;

  const [a, b] = partnerCards;
  if (a.rank !== b.rank) {
    const deep = a.rank > b.rank ? a : b;
    const high = deep === a ? b : a;
    const deepOnRight = deep.x > high.x;
    const from: Pt = { x: deepOnRight ? high.x + high.w : high.x, y: high.y + H / 2 };
    const to: Pt = { x: deepOnRight ? deep.x : deep.x + deep.w, y: deep.y + H / 2 };
    return { ...base, mode: 'split', cx: deep.x + deep.w / 2, cy: deep.y + H, line: [from, to], rank: deep.rank };
  }

  const item = part.blockOf.get(f.partners[0])!;
  const g = part.junctionGap(item, f);
  const left = a.x < b.x ? a : b;
  const right = left === a ? b : a;
  const midY = left.y + H / 2;
  const jx = item.x + part.junctionOffset(item, f);
  const i = item.members.indexOf(left.personId);
  const j = item.members.indexOf(right.personId);
  let mode: UnionMode = 'gap';
  let line: Pt[];
  if (j === i + 1) {
    line = [
      { x: left.x + left.w, y: midY },
      { x: right.x, y: midY },
    ];
  } else {
    mode = 'bridge';
    const n = bridgesInBlock.get(item) ?? 0;
    bridgesInBlock.set(item, n + 1);
    const liftY = left.y - BRIDGE_LIFT - n * BRIDGE_STEP;
    if (g === i) {
      // Marker next to the left partner; the line arches over from the right partner.
      const sx = right.x + BRIDGE_INSET;
      line = [
        { x: sx, y: right.y },
        { x: sx, y: liftY },
        { x: jx, y: liftY },
        { x: jx, y: midY },
        { x: left.x + left.w, y: midY },
      ];
    } else {
      const sx = left.x + left.w - BRIDGE_INSET;
      line = [
        { x: sx, y: left.y },
        { x: sx, y: liftY },
        { x: jx, y: liftY },
        { x: jx, y: midY },
        { x: right.x, y: midY },
      ];
    }
  }
  return { ...base, mode, cx: jx, cy: midY, line, rank: left.rank };
}
