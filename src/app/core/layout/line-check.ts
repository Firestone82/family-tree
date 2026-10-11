/**
 * Where the drawn lines of a layout get in each other's way: a family's line
 * crossing another family's, two families' lines running on top of each other,
 * or a line running behind a card. It looks at the lines as the chart draws
 * them with square corners (stems, bars, drops, the lines between partners and
 * the dashed links), not at the straight parent-child links the ordering
 * counts, so it also sees a stem passing through a bar on another track.
 * The layout uses it to choose between arrangements; tests use it too.
 */
import { TreeDocument } from '../model/types';
import { LayoutResult, Pt } from './layout-types';

export interface Segment {
  a: Pt;
  b: Pt;
  /** The family the line belongs to. Lines of one family may meet and share. */
  owner: string;
}

export interface LineProblems {
  /** Places where lines of two different families cross. */
  crossings: number;
  /** Stretches where lines of two different families run on top of each other. */
  overlaps: number;
  /** Lines that pass behind a card. */
  hidden: number;
  /** Cards standing right under another family's bar, as if they were its children. */
  under: number;
  /** What was found, for tests and debugging. */
  details: string[];
}

/** Lines closer than this count as on top of each other. */
const NEAR = 3;
const EPS = 0.5;
/** Points along each curve of a dashed link. */
const CURVE_STEPS = 12;

/** The drawn lines of a layout, merged per family, as straight segments. */
export function lineSegments(layout: LayoutResult): Segment[] {
  const raw: Segment[] = [];
  const polyline = (owner: string, pts: Pt[]) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (Math.abs(a.x - b.x) > 0.05 || Math.abs(a.y - b.y) > 0.05) raw.push({ a, b, owner });
    }
  };
  for (const c of layout.connectors) {
    const single = c.drops.length === 1;
    for (const drop of c.drops) {
      // As connectorPaths draws square lines: down the stem, along the bar, down to the child.
      const stem = single && Math.abs(drop.x - c.stem.x) <= 3 ? { x: drop.x, y: c.stem.y } : c.stem;
      const pts: Pt[] = [stem];
      if (Math.abs(drop.x - stem.x) > 0.5) pts.push({ x: stem.x, y: c.barY }, { x: drop.x, y: c.barY });
      let x = drop.x;
      for (const p of drop.points) {
        const nx = Math.abs(p.x - x) <= 3 ? x : p.x;
        pts.push({ x: nx, y: p.y });
        x = nx;
      }
      polyline(c.familyId, pts);
    }
  }
  for (const u of layout.unions) if (u.line.length > 1) polyline(u.familyId, u.mode === 'split' ? [u.line[0], u.line[u.line.length - 1]] : u.line);
  for (const l of layout.links) {
    const pts: Pt[] = [l.from];
    const turn = (l.clearY - l.from.y) * (l.to.y - l.clearY) > 0 ? { x: l.from.x, y: l.clearY } : l.from;
    if (turn !== l.from) pts.push(turn);
    const my = (turn.y + l.to.y) / 2;
    for (let s = 1; s <= CURVE_STEPS; s++) {
      const t = s / CURVE_STEPS;
      const u = 1 - t;
      pts.push({
        x: u ** 3 * turn.x + 3 * u * u * t * turn.x + 3 * u * t * t * l.to.x + t ** 3 * l.to.x,
        y: u ** 3 * turn.y + 3 * u * u * t * my + 3 * u * t * t * my + t ** 3 * l.to.y,
      });
    }
    polyline(`link:${l.familyId}:${l.childId}`, pts);
  }
  return merge(raw);
}

/**
 * Counts crossings, overlaps and hidden lines (see LineProblems). Cards under
 * another family's bar are counted when everyone's `partners` are given.
 */
export function lineProblems(layout: LayoutResult, partners?: ReadonlyMap<string, readonly string[]>, withDetails = false): LineProblems {
  const segments = lineSegments(layout);
  const details: string[] = [];
  const note = (s: string) => {
    if (withDetails) details.push(s);
  };
  const horizontal = segments.filter((s) => Math.abs(s.a.y - s.b.y) < 0.05).map(sorted);
  const vertical = segments.filter((s) => Math.abs(s.a.x - s.b.x) < 0.05).map(sorted);
  const other = segments.filter((s) => Math.abs(s.a.y - s.b.y) >= 0.05 && Math.abs(s.a.x - s.b.x) >= 0.05);

  let crossings = 0;
  let overlaps = 0;
  // Horizontal against vertical: sort the verticals by x and look only at those under each horizontal.
  const byX = [...vertical].sort((p, q) => p.a.x - q.a.x);
  for (const h of horizontal) {
    const y = h.a.y;
    for (let i = lowerBound(byX, h.a.x + EPS); i < byX.length && byX[i].a.x < h.b.x - EPS; i++) {
      const v = byX[i];
      if (v.owner === h.owner) continue;
      if (y > v.a.y + EPS && y < v.b.y - EPS) {
        crossings++;
        note(`cross ${h.owner} / ${v.owner} at ${v.a.x.toFixed(0)},${y.toFixed(0)}`);
      }
    }
  }
  // Lines of two families along the same row of the gap, or down the same column.
  overlaps += collinear(
    horizontal,
    (s) => s.a.y,
    (s) => [s.a.x, s.b.x],
    note,
    'along',
  );
  overlaps += collinear(
    vertical,
    (s) => s.a.x,
    (s) => [s.a.y, s.b.y],
    note,
    'down',
  );
  // Curves (dashed links) against everything else.
  for (const c of other) {
    for (const s of segments) {
      if (s === c || s.owner === c.owner || sameFamily(s.owner, c.owner)) continue;
      if (intersects(c, s)) {
        crossings++;
        note(`cross ${c.owner} / ${s.owner}`);
      }
    }
  }
  // Any line behind a card, other than where it reaches the card.
  let hidden = 0;
  for (const s of segments) {
    for (const card of layout.cards) {
      if (throughRect(s, card.x + EPS, card.y + EPS, card.x + card.w - EPS, card.y + card.h - EPS)) {
        hidden++;
        note(`behind ${card.personId}: ${s.owner}`);
      }
    }
  }
  // Cards right under a family's bar that are neither its children nor their partners.
  let under = 0;
  if (partners) {
    for (const c of layout.connectors) {
      const xs = [c.stem.x, ...c.drops.map((d) => d.x)];
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      if (hi - lo < 2) continue;
      const below = layout.cards.filter((k) => k.y > c.barY);
      if (!below.length) continue;
      const top = Math.min(...below.map((k) => k.y));
      const own = new Set(c.drops.map((d) => d.childId));
      for (const id of [...own]) for (const p of partners.get(id) ?? []) own.add(p);
      for (const k of below) {
        if (k.y !== top || own.has(k.personId)) continue;
        const mid = k.x + k.w / 2;
        if (mid > lo + 1 && mid < hi - 1) {
          under++;
          note(`under ${c.familyId}: ${k.personId}`);
        }
      }
    }
  }
  return { crossings, overlaps, hidden, under, details };
}

/** Everyone's partners, for counting cards under other families' bars (see lineProblems). */
export function partnersIn(doc: TreeDocument): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of doc.families) {
    if (f.partners.length !== 2) continue;
    const [a, b] = f.partners;
    out.set(a, [...(out.get(a) ?? []), b]);
    out.set(b, [...(out.get(b) ?? []), a]);
  }
  return out;
}

function sameFamily(a: string, b: string): boolean {
  // A dashed link starts at its family's stem.
  return a.startsWith('link:') ? a.split(':')[1] === b : b.startsWith('link:') ? b.split(':')[1] === a : false;
}

function sorted(s: Segment): Segment {
  return s.a.x > s.b.x + 0.05 || (Math.abs(s.a.x - s.b.x) <= 0.05 && s.a.y > s.b.y) ? { a: s.b, b: s.a, owner: s.owner } : s;
}

function lowerBound(list: Segment[], x: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].a.x < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function collinear(list: Segment[], level: (s: Segment) => number, span: (s: Segment) => [number, number], note: (s: string) => void, word: string): number {
  const byLevel = [...list].sort((p, q) => level(p) - level(q));
  let count = 0;
  for (let i = 0; i < byLevel.length; i++) {
    for (let j = i + 1; j < byLevel.length && level(byLevel[j]) - level(byLevel[i]) < NEAR; j++) {
      const p = byLevel[i];
      const q = byLevel[j];
      if (p.owner === q.owner || sameFamily(p.owner, q.owner)) continue;
      const [p1, p2] = span(p);
      const [q1, q2] = span(q);
      if (Math.min(p2, q2) - Math.max(p1, q1) > NEAR) {
        count++;
        note(`${word} ${p.owner} / ${q.owner} at ${level(p).toFixed(0)}`);
      }
    }
  }
  return count;
}

/** Joins each family's pieces of line that lie on one another, so a shared stem or bar counts once. */
function merge(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  const groups = new Map<string, Segment[]>();
  for (const s of segments) {
    const h = Math.abs(s.a.y - s.b.y) < 0.05;
    const v = Math.abs(s.a.x - s.b.x) < 0.05;
    if (!h && !v) {
      out.push(s);
      continue;
    }
    const key = `${s.owner}|${h ? 'h' : 'v'}|${Math.round((h ? s.a.y : s.a.x) * 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), sorted(s)]);
  }
  for (const [key, list] of groups) {
    const h = key.split('|')[1] === 'h';
    const lo = (s: Segment) => (h ? s.a.x : s.a.y);
    const hi = (s: Segment) => (h ? s.b.x : s.b.y);
    list.sort((p, q) => lo(p) - lo(q));
    let cur = list[0];
    for (const s of list.slice(1)) {
      if (lo(s) <= hi(cur) + 0.05) {
        if (hi(s) > hi(cur)) cur = { a: cur.a, b: s.b, owner: cur.owner };
      } else {
        out.push(cur);
        cur = s;
      }
    }
    out.push(cur);
  }
  return out;
}

function intersects(p: Segment, q: Segment): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(q.a, q.b, p.a);
  const d2 = d(q.a, q.b, p.b);
  const d3 = d(p.a, p.b, q.a);
  const d4 = d(p.a, p.b, q.b);
  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6;
}

/** Whether a segment passes through the inside of a rectangle. */
function throughRect(s: Segment, x1: number, y1: number, x2: number, y2: number): boolean {
  // Clip the segment to the rectangle (Liang-Barsky); any length left inside counts.
  let t0 = 0;
  let t1 = 1;
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const edges: [number, number][] = [
    [-dx, s.a.x - x1],
    [dx, x2 - s.a.x],
    [-dy, s.a.y - y1],
    [dy, y2 - s.a.y],
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return (t1 - t0) * Math.hypot(dx, dy) > 1;
}
