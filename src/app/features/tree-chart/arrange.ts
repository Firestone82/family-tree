/**
 * Arranging the chart by hand: what is being dragged, how the chart looks
 * while it is, and what can be grabbed. The changes themselves are kept in the
 * tree (core/model/arrangement.ts) and applied by the layout once let go.
 */
import { LayoutResult, Pt } from '../../core/layout/layout-types';
import { TreeIndex } from '../../core/model/tree-index';
import { Arrangement } from '../../core/model/types';

/** A line moved by hand stays this far below the cards above it (as the layout keeps it). */
export const LINE_CLEARANCE = 10;
/** Pointer travel, in screen pixels, before a press becomes a drag. */
export const DRAG_START = 4;

export type ArrangeDrag =
  /** A couple (everyone in one block of partners) moved sideways by dx. */
  | { kind: 'card'; members: readonly string[]; families: readonly string[]; dx: number }
  /** A family's line moved down by dy (up when negative). */
  | { kind: 'line'; familyId: string; dy: number };

/** A family's line that can be grabbed: its stretch along the gap, and whether it was moved by hand. */
export interface LineGrip {
  familyId: string;
  x1: number;
  x2: number;
  y: number;
  /** Where the grip sits: the middle of the line. */
  x: number;
  moved: boolean;
}

/** A couple that can be turned round: where its button sits, and who would go on the left. */
export interface CoupleSwitch {
  familyId: string;
  x: number;
  y: number;
  /** The partner now on the right, who goes on the left when turned. */
  right: string;
}

/** A couple moved by hand, with where its "put back" button sits. */
export interface MovedBlock {
  members: string[];
  x: number;
  y: number;
}

/**
 * Everyone who moves with `personId`: the partners beside them in their row,
 * and theirs. The families whose marker moves with them are those whose
 * partners all move.
 */
export function blockOf(layout: LayoutResult, index: TreeIndex, personId: string): { members: string[]; families: string[] } {
  const y = new Map(layout.cards.map((c) => [c.personId, c.y]));
  const members = new Set([personId]);
  const queue = [personId];
  for (const id of queue) {
    for (const f of index.partnerFamilies(id)) {
      for (const p of f.partners) {
        if (!members.has(p) && y.has(p) && y.get(p) === y.get(id)) {
          members.add(p);
          queue.push(p);
        }
      }
    }
  }
  const families = new Set<string>();
  for (const id of members) {
    for (const f of index.partnerFamilies(id)) if (f.partners.every((p) => members.has(p))) families.add(f.id);
  }
  return { members: [...members], families: [...families] };
}

/** The chart as it looks while something is dragged: the couple or the line follows the pointer. */
export function previewLayout(layout: LayoutResult, drag: ArrangeDrag | null): LayoutResult {
  if (!drag) return layout;
  if (drag.kind === 'line') {
    return { ...layout, connectors: layout.connectors.map((c) => (c.familyId === drag.familyId ? { ...c, barY: c.barY + drag.dy } : c)) };
  }
  const members = new Set(drag.members);
  const families = new Set(drag.families);
  const dx = drag.dx;
  const shift = (p: Pt): Pt => ({ x: p.x + dx, y: p.y });
  return {
    ...layout,
    // The couple being dragged is drawn over the others.
    cards: [
      ...layout.cards.filter((c) => !members.has(c.personId)),
      ...layout.cards.filter((c) => members.has(c.personId)).map((c) => ({ ...c, x: c.x + dx })),
    ],
    unions: layout.unions.map((u) => (families.has(u.familyId) ? { ...u, cx: u.cx + dx, line: u.line.map(shift) } : u)),
    connectors: layout.connectors.map((c) => {
      const drops = c.drops.map((d) => {
        if (!members.has(d.childId)) return d;
        const last = d.points.length - 1;
        return { ...d, x: last === 0 ? d.x + dx : d.x, points: d.points.map((p, i) => (i === last ? shift(p) : p)) };
      });
      return families.has(c.familyId) ? { ...c, stem: shift(c.stem), drops } : { ...c, drops };
    }),
    links: layout.links.map((l) => ({ ...l, from: families.has(l.familyId) ? shift(l.from) : l.from, to: members.has(l.childId) ? shift(l.to) : l.to })),
  };
}

/** How far a line can be dragged up: it stays clear of its parents' row. */
export function lowestLineMove(layout: LayoutResult, familyId: string): number {
  const c = layout.connectors.find((x) => x.familyId === familyId);
  return c ? c.clearY + LINE_CLEARANCE - c.barY : 0;
}

/** The family lines that can be grabbed: those with a bar, from one child to another or to the parents. */
export function lineGrips(layout: LayoutResult, arrangement: Arrangement): LineGrip[] {
  const out: LineGrip[] = [];
  for (const c of layout.connectors) {
    const xs = [c.stem.x, ...c.drops.map((d) => d.x)];
    const x1 = Math.min(...xs);
    const x2 = Math.max(...xs);
    if (x2 - x1 < 4) continue;
    out.push({ familyId: c.familyId, x1, x2, y: c.barY, x: (x1 + x2) / 2, moved: arrangement.lines[c.familyId] !== undefined });
  }
  return out;
}

/** Couples side by side, with a button above the marker between them. */
export function coupleSwitches(layout: LayoutResult, index: TreeIndex): CoupleSwitch[] {
  const card = new Map(layout.cards.map((c) => [c.personId, c]));
  const out: CoupleSwitch[] = [];
  for (const u of layout.unions) {
    if (u.mode !== 'gap' && u.mode !== 'bridge') continue;
    const f = index.family(u.familyId);
    if (!f || f.partners.length !== 2) continue;
    const [a, b] = f.partners.map((p) => card.get(p));
    if (!a || !b) continue;
    out.push({ familyId: f.id, x: u.cx, y: Math.min(a.y, b.y) + 14, right: a.x > b.x ? a.personId : b.personId });
  }
  return out;
}

/** Couples moved by hand, each with a "put back" button above its right end. */
export function movedBlocks(layout: LayoutResult, index: TreeIndex, arrangement: Arrangement): MovedBlock[] {
  const done = new Set<string>();
  const out: MovedBlock[] = [];
  const card = new Map(layout.cards.map((c) => [c.personId, c]));
  for (const id of Object.keys(arrangement.moves)) {
    if (done.has(id) || !card.has(id)) continue;
    const { members } = blockOf(layout, index, id);
    for (const m of members) done.add(m);
    const cards = members.map((m) => card.get(m)!).filter(Boolean);
    const right = Math.max(...cards.map((c) => c.x + c.w));
    out.push({ members, x: right - 12, y: cards[0].y - 13 });
  }
  return out;
}
