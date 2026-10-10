/**
 * Geometry for hand-drawn looking lines: smooth curves through points and
 * filled outlines that taper like branches.
 */
import { Pt } from './layout-types';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A smooth line through the points, as vertical S-curves between neighbours. */
export function centerline(points: readonly Pt[], samples = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const my = (a.y + b.y) / 2;
    for (let k = i === 0 ? 0 : 1; k <= samples; k++) {
      const t = k / samples;
      const u = 1 - t;
      out.push({
        x: u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * b.y,
      });
    }
  }
  return out;
}

/** Points along a cubic Bézier curve. */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, samples = 16): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k <= samples; k++) {
    const t = k / samples;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** A curve that leaves `a` in direction `angle` and bends towards `b`. */
export function bentLine(a: Pt, b: Pt, angle: number, samples = 14): Pt[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const c1 = { x: a.x + Math.cos(angle) * d * 0.45, y: a.y + Math.sin(angle) * d * 0.45 };
  const c2 = { x: (a.x + b.x) / 2 + (c1.x - a.x) * 0.2, y: (a.y + b.y) / 2 + (c1.y - a.y) * 0.2 };
  return cubic(a, c1, c2, b, samples);
}

export function lengths(line: readonly Pt[]): number[] {
  const s = [0];
  for (let i = 1; i < line.length; i++) s.push(s[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
  return s;
}

export function tangent(line: readonly Pt[], i: number): Pt {
  const a = line[Math.max(0, i - 1)];
  const b = line[Math.min(line.length - 1, i + 1)];
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** Width along a line, from `w0` at the start to `w1` at the end. */
export function widthAt(w0: number, w1: number, t: number): number {
  return w0 + (w1 - w0) * Math.pow(t, 0.8);
}

/**
 * A filled outline along the line. `width` gives the width at each point,
 * from 0 (start) to 1 (end); the end is rounded off. `wobble` (a share of the
 * width) makes the two edges slightly uneven, like a drawn branch.
 */
export function outline(line: readonly Pt[], width: (t: number) => number, wobble = 0, seed = 0): string {
  if (line.length < 2) return '';
  const s = lengths(line);
  const total = s[s.length - 1] || 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  let last = 0;
  line.forEach((p, i) => {
    const t = tangent(line, i);
    const w = (last = width(s[i] / total)) / 2;
    // Two slow waves per edge, out of step with each other.
    const wl = wobble ? w * (1 + wobble * (Math.sin(s[i] / 23 + seed) * 0.6 + Math.sin(s[i] / 9.7 + seed * 1.7) * 0.4)) : w;
    const wr = wobble ? w * (1 + wobble * (Math.sin(s[i] / 19 + seed * 2.3) * 0.6 + Math.sin(s[i] / 8.3 + seed * 0.7) * 0.4)) : w;
    left.push({ x: p.x - t.y * wl, y: p.y + t.x * wl });
    right.push({ x: p.x + t.y * wr, y: p.y - t.x * wr });
  });
  let d = `M${r1(left[0].x)},${r1(left[0].y)}`;
  for (let i = 1; i < left.length; i++) d += `L${r1(left[i].x)},${r1(left[i].y)}`;
  const end = right[right.length - 1];
  const r = Math.max(0.5, last / 2);
  d += `A${r1(r)},${r1(r)} 0 0 1 ${r1(end.x)},${r1(end.y)}`;
  for (let i = right.length - 2; i >= 0; i--) d += `L${r1(right[i].x)},${r1(right[i].y)}`;
  return d + 'Z';
}

/** A filled outline along the line, `w0` wide at the start and `w1` at the end, with a rounded tip. */
export function taperedPath(line: readonly Pt[], w0: number, w1: number): string {
  return outline(line, (t) => widthAt(w0, w1, t));
}

/** A line running alongside `line`, `share` of the local half-width off the middle. */
export function offsetPath(line: readonly Pt[], w0: number, w1: number, share: number, from = 0.08, to = 0.85): string {
  return offsetLine(line, (t) => widthAt(w0, w1, t), share, from, to);
}

/** Like offsetPath, with the width given as a function along the line. */
export function offsetLine(line: readonly Pt[], width: (t: number) => number, share: number, from = 0.08, to = 0.85): string {
  const s = lengths(line);
  const total = s[s.length - 1] || 1;
  let d = '';
  line.forEach((p, i) => {
    const t = s[i] / total;
    if (t < from || t > to) return;
    const tg = tangent(line, i);
    const off = (width(t) / 2) * share;
    d += `${d ? 'L' : 'M'}${r1(p.x - tg.y * off)},${r1(p.y + tg.x * off)}`;
  });
  return d;
}

/** A small, fast pseudo-random generator, so a drawing comes out the same every time. */
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
