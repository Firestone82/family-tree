/**
 * Turns layout geometry into SVG path data. Kept separate from the layout so the
 * same geometry can be drawn with square (rounded) or curved lines, and so the
 * geometry can be animated before it is turned into paths.
 */
import { Family, LineStyle } from '../model/types';
import { LayoutConnector, LayoutDrop, LayoutLink, LayoutUnion, Pt } from './layout-types';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A polyline with rounded corners. */
export function roundedPath(points: Pt[], radius: number): string {
  const pts = dedupe(points);
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${r1(pts[0].x)},${r1(pts[0].y)}`;
  let d = `M${r1(pts[0].x)},${r1(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const inLen = dist(prev, cur);
    const outLen = dist(cur, next);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.5 || collinear(prev, cur, next)) {
      d += `L${r1(cur.x)},${r1(cur.y)}`;
      continue;
    }
    const a = towards(cur, prev, r);
    const b = towards(cur, next, r);
    d += `L${r1(a.x)},${r1(a.y)}Q${r1(cur.x)},${r1(cur.y)} ${r1(b.x)},${r1(b.y)}`;
  }
  const last = pts[pts.length - 1];
  d += `L${r1(last.x)},${r1(last.y)}`;
  return d;
}

/** A smooth vertical S-curve between two points. */
export function sCurve(a: Pt, b: Pt): string {
  return `M${r1(a.x)},${r1(a.y)}${sCurveTo(a, b)}`;
}

/** The curve command of an S-curve from a (the current point) to b. */
function sCurveTo(a: Pt, b: Pt): string {
  const my = (a.y + b.y) / 2;
  return `C${r1(a.x)},${r1(my)} ${r1(b.x)},${r1(my)} ${r1(b.x)},${r1(b.y)}`;
}

/**
 * An S-curve from a family's stem that runs straight down to `clearY`, the
 * edge of the parents' row, before it turns. A stem starts between the
 * partners' cards, and a curve that turned there would pass behind them.
 */
export function stemCurve(stem: Pt, clearY: number, to: Pt): string {
  if ((clearY - stem.y) * (to.y - clearY) <= 0) return sCurve(stem, to);
  const turn: Pt = { x: stem.x, y: clearY };
  return `M${r1(stem.x)},${r1(stem.y)}L${r1(turn.x)},${r1(turn.y)}${sCurveTo(turn, to)}`;
}

/** A smooth horizontal curve between two points (for partners in different rows). */
export function hCurve(a: Pt, b: Pt): string {
  const mx = (a.x + b.x) / 2;
  return `M${r1(a.x)},${r1(a.y)}C${r1(mx)},${r1(a.y)} ${r1(mx)},${r1(b.y)} ${r1(b.x)},${r1(b.y)}`;
}

export function unionLinePath(union: LayoutUnion, radius = 8): string {
  if (!union.line.length) return '';
  if (union.mode === 'split') return hCurve(union.line[0], union.line[union.line.length - 1]);
  return roundedPath(union.line, radius);
}

export interface DropPath {
  childId: string;
  relation: LayoutConnector['drops'][number]['relation'];
  d: string;
}

/**
 * One path per child, from the family's stem to the child's card. With square
 * lines the paths share the stem and bar, which overlap exactly.
 */
/** Offsets smaller than this are drawn as straight lines; nobody can see 3 px. */
const SNAP = 3;

/**
 * The lines from a family down to each child. Children born together (twins:
 * `together` gives each child's birth group) hang from one point on the bar,
 * the genealogical sign for twins.
 */
export function connectorPaths(c: LayoutConnector, style: LineStyle, radius = 10, together?: ReadonlyMap<string, string>): DropPath[] {
  const single = c.drops.length === 1;
  const forks = twinForks(c, together);
  return c.drops.map((drop) => {
    const target = drop.points[drop.points.length - 1];
    const fork = forks.get(drop.childId);
    if (fork) {
      const head =
        style === 'curved'
          ? stemCurve(c.stem, c.clearY, fork)
          : roundedPath(Math.abs(fork.x - c.stem.x) > 0.5 ? [c.stem, { x: c.stem.x, y: c.barY }, fork] : [c.stem, fork], radius);
      return { childId: drop.childId, relation: drop.relation, d: `${head}L${r1(target.x)},${r1(target.y)}` };
    }
    if (style === 'curved' && drop.points.length === 1) {
      if (Math.abs(target.x - c.stem.x) <= SNAP) {
        return { childId: drop.childId, relation: drop.relation, d: roundedPath([{ x: target.x, y: c.stem.y }, target], radius) };
      }
      return { childId: drop.childId, relation: drop.relation, d: stemCurve(c.stem, c.clearY, target) };
    }
    // A single child almost straight below its parents gets a straight line.
    const stem = single && Math.abs(drop.x - c.stem.x) <= SNAP ? { x: drop.x, y: c.stem.y } : c.stem;
    const pts: Pt[] = [stem];
    if (Math.abs(drop.x - stem.x) > 0.5) pts.push({ x: stem.x, y: c.barY }, { x: drop.x, y: c.barY });
    let x = drop.x;
    for (const p of drop.points) {
      // Tiny jogs along a long line are straightened the same way.
      const nx = Math.abs(p.x - x) <= SNAP ? x : p.x;
      pts.push({ x: nx, y: p.y });
      x = nx;
    }
    return { childId: drop.childId, relation: drop.relation, d: roundedPath(pts, radius) };
  });
}

/** Each child's birth group in a family, for drawing twins (see connectorPaths). */
export function bornTogether(family: Family | undefined): ReadonlyMap<string, string> | undefined {
  if (!family?.children.some((c) => c.birthGroup)) return undefined;
  return new Map(family.children.filter((c) => c.birthGroup).map((c) => [c.personId, c.birthGroup!]));
}

/** For each child born together with siblings (and drawn straight below the bar), the point their lines share. */
function twinForks(c: LayoutConnector, together: ReadonlyMap<string, string> | undefined): Map<string, Pt> {
  const out = new Map<string, Pt>();
  if (!together) return out;
  const groups = new Map<string, LayoutDrop[]>();
  for (const d of c.drops) {
    const g = together.get(d.childId);
    if (g && d.points.length === 1) groups.set(g, [...(groups.get(g) ?? []), d]);
  }
  for (const drops of groups.values()) {
    if (drops.length < 2) continue;
    const x = drops.reduce((sum, d) => sum + d.x, 0) / drops.length;
    for (const d of drops) out.set(d.childId, { x, y: c.barY });
  }
  return out;
}

export function linkPath(link: LayoutLink): string {
  return stemCurve(link.from, link.clearY, link.to);
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function towards(from: Pt, to: Pt, len: number): Pt {
  const d = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / d) * len, y: from.y + ((to.y - from.y) / d) * len };
}

function collinear(a: Pt, b: Pt, c: Pt): boolean {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 0.01;
}

function dedupe(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.05 || Math.abs(last.y - p.y) > 0.05) out.push(p);
  }
  return out;
}

/** Where a union's marker sits, or null when it has none (a lone parent, parents not known). */
export function unionMarkerPoint(u: LayoutUnion): Pt | null {
  if (u.mode === 'split' && u.line.length === 2) return { x: (u.line[0].x + u.line[1].x) / 2, y: (u.line[0].y + u.line[1].y) / 2 };
  if (u.mode === 'gap' || u.mode === 'bridge' || u.mode === 'split') return { x: u.cx, y: u.cy };
  return null;
}
