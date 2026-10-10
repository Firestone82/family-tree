/**
 * Leaves for the tree drawn behind the chart. Foliage is painted the way an
 * illustrator would: soft masses of leaves in three tones (shade below, the
 * body, light on top) with single leaves around their edges and at the ends
 * of twigs. Everything of one tone is collected into one path, so a whole
 * crown is a handful of SVG elements.
 */
import { Pt } from './layout-types';

const r1 = (v: number) => Math.round(v * 10) / 10;
const TAU = Math.PI * 2;

/** Leaf tones, darkest first. */
export const LEAF_TONES = 4;

export interface Foliage {
  /** Masses of leaves: their shaded underside, their body and the light catching their tops. */
  shade: string[];
  body: string[];
  light: string[];
  /** Single leaves, by tone (0 is the darkest). */
  leaves: string[][];
}

export function emptyFoliage(): Foliage {
  return { shade: [], body: [], light: [], leaves: Array.from({ length: LEAF_TONES }, () => []) };
}

export function circlePath(x: number, y: number, r: number): string {
  return `M${r1(x - r)},${r1(y)}a${r1(r)},${r1(r)} 0 1,0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1,0 ${r1(-r * 2)},0Z`;
}

/** One leaf growing from `p` towards `angle`: a pointed oval, slightly fuller near the stalk. */
export function leafPath(p: Pt, angle: number, len: number, width = 0.42): string {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const w = (len * width) / 2;
  const at = (u: number, v: number) => `${r1(p.x + ca * u - sa * v)},${r1(p.y + sa * u + ca * v)}`;
  return (
    `M${at(0, 0)}` +
    `C${at(len * 0.22, -w * 1.25)} ${at(len * 0.7, -w * 1.05)} ${at(len, 0)}` +
    `C${at(len * 0.7, w * 1.05)} ${at(len * 0.22, w * 1.25)} ${at(0, 0)}Z`
  );
}

/** A tone for a leaf: lighter towards the top of a mass, darker underneath, with some variety. */
function tone(rnd: () => number, height: number): number {
  // height: -1 at the bottom of a mass, 1 at the top.
  const t = (height + 1) / 2 + (rnd() - 0.5) * 0.7;
  return Math.max(0, Math.min(LEAF_TONES - 1, Math.floor(t * LEAF_TONES)));
}

export interface ClumpOptions {
  /** How many leaves around the edge, roughly. */
  leaves?: number;
  /** Flattening of the mass (1 is round). */
  squash?: number;
}

/**
 * A mass of foliage around `c` with radius `r`: overlapping circles make a
 * cloud-like outline, shaded underneath and lit on top, with leaves breaking
 * up its edge.
 */
export function clump(f: Foliage, c: Pt, r: number, leafLen: number, rnd: () => number, o: ClumpOptions = {}): void {
  const squash = o.squash ?? 0.82;
  const blobs = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < blobs; i++) {
    const a = rnd() * TAU;
    const d = i === 0 ? 0 : r * (0.3 + rnd() * 0.42);
    const br = r * (i === 0 ? 0.62 : 0.34 + rnd() * 0.26);
    const x = c.x + Math.cos(a) * d;
    const y = c.y + Math.sin(a) * d * squash;
    f.shade.push(circlePath(x + br * 0.1, y + br * 0.16, br));
    f.body.push(circlePath(x, y, br * 0.92));
    if (Math.sin(a) < 0.3 && rnd() < 0.75) f.light.push(circlePath(x - br * 0.18, y - br * 0.26, br * 0.52));
  }
  // Leaves around the edge, pointing outwards, more of them on top.
  const count = o.leaves ?? Math.round(8 + (r / Math.max(4, leafLen)) * 3);
  for (let i = 0; i < count; i++) {
    let a = rnd() * TAU;
    // Favour the upper half: an illustrator's crown is fuller where the light is.
    if (Math.sin(a) > 0.2 && rnd() < 0.55) a = -a;
    const edge = r * (0.72 + rnd() * 0.32);
    const base = { x: c.x + Math.cos(a) * edge, y: c.y + Math.sin(a) * edge * squash };
    const dir = a + (rnd() - 0.5) * 1.1;
    const len = leafLen * (0.75 + rnd() * 0.55);
    f.leaves[tone(rnd, -Math.sin(a))].push(leafPath(base, dir, len));
  }
  // A few leaves on the face of the mass, for texture.
  const inner = Math.round(count * 0.35);
  for (let i = 0; i < inner; i++) {
    const a = rnd() * TAU;
    const d = r * Math.sqrt(rnd()) * 0.6;
    const base = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * squash };
    f.leaves[tone(rnd, -Math.sin(a) * (d / r))].push(leafPath(base, rnd() * TAU, leafLen * (0.7 + rnd() * 0.4)));
  }
}

/** Leaves in pairs along a line (a twig), alternating sides, and one at the end. */
export function leavesAlong(f: Foliage, line: readonly Pt[], leafLen: number, rnd: () => number, from = 0.25): void {
  let total = 0;
  const s = [0];
  for (let i = 1; i < line.length; i++) s.push((total += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)));
  if (total < leafLen) return;
  let side = rnd() < 0.5 ? 1 : -1;
  let i = 0;
  for (let at = total * from; at < total - leafLen * 0.3; at += leafLen * (0.55 + rnd() * 0.35)) {
    while (i + 1 < s.length && s[i + 1] < at) i++;
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    const leafAngle = dir + side * (0.7 + rnd() * 0.35);
    f.leaves[tone(rnd, -Math.sin(leafAngle) * 0.5)].push(leafPath(line[i], leafAngle, leafLen * (0.7 + rnd() * 0.4)));
    side = -side;
  }
  const end = line[line.length - 1];
  const prev = line[Math.max(0, line.length - 3)];
  f.leaves[tone(rnd, 0.3)].push(leafPath(end, Math.atan2(end.y - prev.y, end.x - prev.x), leafLen * 1.05));
}

export interface CanopyOptions {
  /** How far the foliage reaches beyond the outermost points. */
  spread: number;
  leafLen: number;
  rnd: () => number;
}

/**
 * The crown of the tree: one rounded mass of foliage around all the given
 * points (the families the limbs reach). Its edge is a ring of leafy lobes,
 * each shaded underneath and lit on top, the way an illustrator builds up a
 * crown; leaves break up the outline and gather in rosettes on its face.
 */
export function canopy(f: Foliage, points: readonly Pt[], o: CanopyOptions): void {
  if (!points.length) return;
  const { spread, leafLen, rnd } = o;
  const lobes = roundOut(roundedHull(convexHull(points), spread, spread * 0.3, rnd), 0.6);
  const ring = smoothRing(lobes, 2);
  if (ring.length < 3) return;
  // Wind the outline the same way as the circles, so where they overlap in one path they add up instead of cancelling.
  const rim = signedArea(ring) > 0 ? [...ring].reverse() : ring;
  const polygon = (pts: readonly Pt[], dx = 0, dy = 0) => `M${pts.map((p) => `${r1(p.x + dx)},${r1(p.y + dy)}`).join('L')}Z`;
  f.shade.push(polygon(rim, spread * 0.03, spread * 0.1));
  f.body.push(polygon(rim));

  // Lobes along the edge, each a small mass of its own.
  for (const q of lobes) {
    const out = q.angle;
    const below = Math.sin(out);
    const r = spread * (0.24 + rnd() * 0.16);
    const c = { x: q.x - Math.cos(out) * r * 0.3, y: q.y - Math.sin(out) * r * 0.3 };
    f.shade.push(circlePath(c.x + r * 0.1, c.y + r * (0.16 + Math.max(0, below) * 0.14), r));
    f.body.push(circlePath(c.x, c.y, r * 0.94));
    if (below < 0.2) f.light.push(circlePath(c.x - r * 0.18, c.y - r * 0.3, r * (0.42 + rnd() * 0.12)));
    // Leaves around the outer side of the lobe.
    const count = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++) {
      const a = out + (rnd() - 0.5) * 2.4;
      const d = r * (0.7 + rnd() * 0.32);
      const base = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
      f.leaves[tone(rnd, -Math.sin(a))].push(leafPath(base, a + (rnd() - 0.5) * 0.7, leafLen * (0.8 + rnd() * 0.5)));
    }
  }

  // Sprays of leaves on the face of the crown, more of them near the edge.
  const box = bounds(rim);
  const step = spread * 0.55;
  let row = 0;
  for (let y = box.y + step * 0.5; y < box.y + box.h; y += step * 0.87, row++) {
    for (let x = box.x + (row % 2 ? step * 0.5 : 0); x < box.x + box.w; x += step) {
      const p = { x: x + (rnd() - 0.5) * step * 0.7, y: y + (rnd() - 0.5) * step * 0.7 };
      if (!pointInPolygon(p, rim)) continue;
      const edge = distanceToEdge(p, rim);
      if (rnd() > (edge < spread * 0.9 ? 0.85 : 0.35)) continue;
      const height = 1 - (2 * (p.y - box.y)) / box.h;
      spray(f, p, rnd() * TAU, leafLen, rnd, height);
    }
  }
}

/** A few leaves along a short stem pointing one way, as they grow on a twig. */
function spray(f: Foliage, p: Pt, angle: number, leafLen: number, rnd: () => number, height: number): void {
  const n = 2 + Math.floor(rnd() * 3);
  const len = leafLen * (0.6 + n * 0.35);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  let side = rnd() < 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const at = { x: p.x + ca * len * t, y: p.y + sa * len * t };
    const a = angle + side * (0.6 + rnd() * 0.4);
    f.leaves[tone(rnd, height - 0.15)].push(leafPath(at, a, leafLen * (0.7 + rnd() * 0.35)));
    side = -side;
  }
  f.leaves[tone(rnd, height)].push(leafPath({ x: p.x + ca * len, y: p.y + sa * len }, angle + (rnd() - 0.5) * 0.3, leafLen * (0.8 + rnd() * 0.3)));
}

/**
 * Pushes a ring outwards towards the ellipse that fits inside its bounding
 * box, by `share` of the way, so a crown shaped like a funnel or a wedge (the
 * outline of the families it covers) becomes rounder, as crowns are.
 */
function roundOut(ring: RimPoint[], share: number): RimPoint[] {
  if (ring.length < 3) return ring;
  const box = bounds(ring);
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const rx = box.w / 2;
  const ry = box.h / 2;
  return ring.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const rho = Math.hypot(dx, dy);
    if (rho < 1e-6) return p;
    const phi = Math.atan2(dy, dx);
    const ellipse = 1 / Math.sqrt((Math.cos(phi) / rx) ** 2 + (Math.sin(phi) / ry) ** 2);
    if (ellipse <= rho) return p;
    const d = rho + (ellipse - rho) * share;
    const nx = Math.cos(phi) / (rx * rx);
    const ny = Math.sin(phi) / (ry * ry);
    return { x: c.x + Math.cos(phi) * d, y: c.y + Math.sin(phi) * d, angle: Math.atan2(ny, nx) };
  });
}

/** Rounds off a closed ring of points (Chaikin's corner cutting), keeping each point's direction. */
function smoothRing(ring: RimPoint[], times: number): RimPoint[] {
  let pts = ring;
  for (let k = 0; k < times && pts.length > 2; k++) {
    const next: RimPoint[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const angle = Math.atan2(Math.sin(a.angle) + Math.sin(b.angle), Math.cos(a.angle) + Math.cos(b.angle));
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25, angle: a.angle });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, angle });
    }
    pts = next;
  }
  return pts;
}

type RimPoint = Pt & { angle: number };

/** Convex hull of points (Andrew's monotone chain), counter-clockwise on screen. */
function convexHull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Points every `step` along the hull grown outwards by `spread` (round at the
 * corners), each with the direction pointing out of the crown. The distance
 * wavers a little, so the crown is not a perfect shape.
 */
function roundedHull(hull: readonly Pt[], spread: number, step: number, rnd: () => number): RimPoint[] {
  const out: RimPoint[] = [];
  const push = (cx: number, cy: number, angle: number) => {
    const d = spread * (0.92 + rnd() * 0.16);
    out.push({ x: cx + Math.cos(angle) * d, y: cy + Math.sin(angle) * d, angle });
  };
  if (hull.length === 1) {
    const n = Math.max(12, Math.round((Math.PI * 2 * spread) / step));
    for (let i = 0; i < n; i++) push(hull[0].x, hull[0].y, (i / n) * Math.PI * 2);
    return out;
  }
  // Orientation: make the outward normal point away from the centre.
  const centre = hull.reduce((s, p) => ({ x: s.x + p.x / hull.length, y: s.y + p.y / hull.length }), { x: 0, y: 0 });
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    let nx = (b.y - a.y) / len;
    let ny = -(b.x - a.x) / len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((mid.x - centre.x) * nx + (mid.y - centre.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const normal = Math.atan2(ny, nx);
    // Round corner at `a`, from the previous edge's normal to this one.
    const prev = out.length ? out[out.length - 1].angle : normal;
    let turn = normal - prev;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const arc = Math.max(1, Math.round((Math.abs(turn) * spread) / step));
    for (let k = 1; k <= arc && out.length; k++) push(a.x, a.y, prev + (turn * k) / arc);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) push(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, normal);
  }
  // Close the last corner.
  if (out.length > 1) {
    const first = out[0].angle;
    const last = out[out.length - 1].angle;
    let turn = first - last;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const arc = Math.round((Math.abs(turn) * spread) / step);
    for (let k = 1; k < arc; k++) push(hull[0].x, hull[0].y, last + (turn * k) / arc);
  }
  return out;
}

/** Twice the signed area of a polygon in screen coordinates; circles from circlePath are negative. */
function signedArea(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

function bounds(pts: readonly Pt[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToEdge(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}
