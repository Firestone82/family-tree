import { LayoutConnector, LayoutResult, Pt } from '../../core/layout/layout-types';

export const EMPTY_LAYOUT: LayoutResult = {
  cards: [],
  placeholders: [],
  unions: [],
  connectors: [],
  links: [],
  rows: [],
  bounds: { x: 0, y: 0, w: 0, h: 0 },
  ranks: new Map(),
  crossings: 0,
};

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const lerpPts = (a: Pt[], b: Pt[], t: number): Pt[] => (a.length === b.length ? b.map((p, i) => lerpPt(a[i], p, t)) : b);

/**
 * A frame between two layouts. Things present in both move; new things appear
 * at their destination; removed things are dropped.
 */
export function lerpLayout(a: LayoutResult, b: LayoutResult, t: number): LayoutResult {
  if (t >= 1) return b;
  const cardsA = new Map(a.cards.map((c) => [c.personId, c]));
  const unionsA = new Map(a.unions.map((u) => [u.familyId, u]));
  const connA = new Map(a.connectors.map((c) => [c.familyId, c]));
  const phA = new Map(a.placeholders.map((p) => [p.familyId, p]));
  const linksA = new Map(a.links.map((l) => [`${l.familyId}|${l.childId}`, l]));
  const rowsA = new Map(a.rows.map((r) => [r.rank, r]));

  return {
    ...b,
    cards: b.cards.map((c) => {
      const p = cardsA.get(c.personId);
      return p ? { ...c, x: lerp(p.x, c.x, t), y: lerp(p.y, c.y, t), h: lerp(p.h, c.h, t), w: lerp(p.w, c.w, t) } : c;
    }),
    placeholders: b.placeholders.map((ph) => {
      const p = phA.get(ph.familyId);
      return p ? { ...ph, cx: lerp(p.cx, ph.cx, t), cy: lerp(p.cy, ph.cy, t) } : ph;
    }),
    unions: b.unions.map((u) => {
      const p = unionsA.get(u.familyId);
      if (!p || p.mode !== u.mode) return u;
      return { ...u, cx: lerp(p.cx, u.cx, t), cy: lerp(p.cy, u.cy, t), line: lerpPts(p.line, u.line, t) };
    }),
    connectors: b.connectors.map((c) => lerpConnector(connA.get(c.familyId), c, t)),
    links: b.links.map((l) => {
      const p = linksA.get(`${l.familyId}|${l.childId}`);
      return p ? { ...l, from: lerpPt(p.from, l.from, t), to: lerpPt(p.to, l.to, t) } : l;
    }),
    rows: b.rows.map((r) => {
      const p = rowsA.get(r.rank);
      return p ? { ...r, y: lerp(p.y, r.y, t), h: lerp(p.h, r.h, t) } : r;
    }),
    bounds: {
      x: lerp(a.bounds.x, b.bounds.x, t),
      y: lerp(a.bounds.y, b.bounds.y, t),
      w: lerp(a.bounds.w, b.bounds.w, t),
      h: lerp(a.bounds.h, b.bounds.h, t),
    },
  };
}

function lerpConnector(a: LayoutConnector | undefined, b: LayoutConnector, t: number): LayoutConnector {
  if (!a) return b;
  const dropsA = new Map(a.drops.map((d) => [d.childId, d]));
  const stem = lerpPt(a.stem, b.stem, t);
  return {
    ...b,
    stem,
    barY: lerp(a.barY, b.barY, t),
    drops: b.drops.map((d) => {
      const p = dropsA.get(d.childId);
      if (p && p.points.length === d.points.length) return { ...d, x: lerp(p.x, d.x, t), points: lerpPts(p.points, d.points, t) };
      // A new child's line grows out of the family's stem.
      return { ...d, x: lerp(a.stem.x, d.x, t), points: d.points.map((pt) => ({ x: lerp(a.stem.x, pt.x, t), y: pt.y })) };
    }),
  };
}

/**
 * How far the chart moved under the person the user is working with, so the
 * view can follow and keep that person still on screen.
 */
export function anchorShift(a: LayoutResult, b: LayoutResult, anchorIds: string[]): Pt {
  const cardsA = new Map(a.cards.map((c) => [c.personId, c]));
  for (const id of anchorIds) {
    const p = cardsA.get(id);
    const c = b.cards.find((x) => x.personId === id);
    if (p && c) return { x: c.x - p.x, y: c.y - p.y };
  }
  let dx = 0;
  let dy = 0;
  let n = 0;
  for (const c of b.cards) {
    const p = cardsA.get(c.personId);
    if (!p) continue;
    dx += c.x - p.x;
    dy += c.y - p.y;
    n++;
  }
  return n ? { x: dx / n, y: dy / n } : { x: 0, y: 0 };
}
