/**
 * Organic lines for the Botanical style: tapered branches with leaves for
 * children, thinner roots for the line of ancestors.
 */
import { Pt } from '../layout/layout-types';
import { lengths, tangent } from '../layout/organic';
import { Rect } from './poster-types';
import { n } from './svg';

export { centerline, taperedPath } from '../layout/organic';

export interface LeafOptions {
  spacing: number;
  size: number;
  colors: readonly string[];
  vein: string;
  /** Places leaves must not cover (cards, labels). */
  avoid: readonly Rect[];
  /** Leaves start this far along the line and stop this far before its end. */
  start: number;
  end: number;
}

/** Leaves along a branch, alternating sides. */
export function leaves(line: Pt[], random: () => number, o: LeafOptions): string {
  const s = lengths(line);
  const total = s[s.length - 1];
  let out = '';
  let side = random() < 0.5 ? 1 : -1;
  let i = 0;
  for (let at = o.start + random() * o.spacing * 0.5; at < total - o.end; at += o.spacing * (0.75 + random() * 0.5)) {
    while (i + 1 < s.length && s[i + 1] < at) i++;
    const p = line[i];
    const t = tangent(line, i);
    const base = Math.atan2(t.y, t.x);
    const angle = base + side * (0.75 + random() * 0.45);
    const len = o.size * (0.75 + random() * 0.5);
    const tip = { x: p.x + Math.cos(angle) * len, y: p.y + Math.sin(angle) * len };
    const mid = { x: (p.x + tip.x) / 2, y: (p.y + tip.y) / 2 };
    side = -side;
    if (o.avoid.some((r) => mid.x > r.x - 3 && mid.x < r.x + r.w + 3 && mid.y > r.y - 3 && mid.y < r.y + r.h + 3)) continue;
    out += leaf(p, angle, len, o.colors[Math.floor(random() * o.colors.length)], o.vein);
  }
  return out;
}

/** One leaf from `p`, pointing at `angle`. */
export function leaf(p: Pt, angle: number, len: number, fill: string, vein: string): string {
  const w = len * 0.42;
  const rot = (angle * 180) / Math.PI;
  return (
    `<g transform="translate(${n(p.x)},${n(p.y)}) rotate(${n(rot)})">` +
    `<path d="M0,0Q${n(len * 0.45)},${n(-w)} ${n(len)},0Q${n(len * 0.45)},${n(w)} 0,0Z" fill="${fill}"/>` +
    `<path d="M${n(len * 0.08)},0L${n(len * 0.8)},0" stroke="${vein}" stroke-width="${n(Math.max(0.35, len * 0.05))}" stroke-linecap="round" fill="none"/>` +
    `</g>`
  );
}

/** A small sprig (a stem with leaves) for decorations, drawn from `p` towards `angle`. */
export function sprig(p: Pt, angle: number, len: number, colors: readonly string[], stem: string, vein: string, seed = 1): string {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const end = { x: p.x + cos * len, y: p.y + sin * len };
  const ctrl = { x: p.x + cos * len * 0.5 - sin * len * 0.12, y: p.y + sin * len * 0.5 + cos * len * 0.12 };
  let out = `<path d="M${n(p.x)},${n(p.y)}Q${n(ctrl.x)},${n(ctrl.y)} ${n(end.x)},${n(end.y)}" fill="none" stroke="${stem}" stroke-width="${n(len * 0.035)}" stroke-linecap="round"/>`;
  const count = 5;
  for (let k = 1; k <= count; k++) {
    const t = k / (count + 1);
    const q = { x: p.x + cos * len * t, y: p.y + sin * len * t };
    const sideAngle = angle + (k % 2 ? 1 : -1) * 0.85;
    out += leaf(q, sideAngle, len * (0.34 - t * 0.12), colors[(k + seed) % colors.length], vein);
  }
  out += leaf(end, angle, len * 0.3, colors[seed % colors.length], vein);
  return out;
}
