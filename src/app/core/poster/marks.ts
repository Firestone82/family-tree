/** Draws a union marker (core/layout/union-marks) as SVG markup in a print style's colours. */
import { UnionMark } from '../layout/union-marks';
import { el, n } from './svg';

export interface MarkColors {
  /** Fill and edge of the plate behind the rings; omit the edge for none. */
  plate: string;
  plateEdge?: string;
  ring: string;
  /** Rings of a couple who broke up; defaults to `ring`. */
  ringApart?: string;
  ringWidth?: number;
  dot?: string;
  /** The slash for a divorce. */
  cut: string;
}

export function drawMark(mark: UnionMark, x: number, y: number, c: MarkColors): string {
  const p = mark.plate;
  const round = p.w === p.h;
  let out = round
    ? el('circle', {
        r: p.w / 2,
        fill: c.plate,
        stroke: c.plateEdge,
        'stroke-width': c.plateEdge ? 0.8 : undefined,
        'stroke-dasharray': mark.apart && c.plateEdge ? '2.2 1.6' : undefined,
      })
    : el('rect', {
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h,
        rx: p.rx,
        fill: c.plate,
        stroke: c.plateEdge,
        'stroke-width': c.plateEdge ? 0.8 : undefined,
        'stroke-dasharray': mark.apart && c.plateEdge ? '2.2 1.6' : undefined,
      });
  const ringColor = mark.apart ? (c.ringApart ?? c.ring) : c.ring;
  for (const r of mark.rings) out += el('circle', { cx: r.cx, cy: r.cy, r: r.r, fill: 'none', stroke: ringColor, 'stroke-width': c.ringWidth ?? 1.3 });
  if (mark.stone) out += el('path', { d: mark.stone, fill: c.plate, stroke: ringColor, 'stroke-width': 1, 'stroke-linejoin': 'round' });
  if (mark.dot) out += el('circle', { r: mark.dot, fill: c.dot ?? c.ring });
  if (mark.slash) {
    out += el('path', { d: mark.slash, fill: 'none', stroke: c.plate, 'stroke-width': 4.2, 'stroke-linecap': 'round' });
    out += el('path', { d: mark.slash, fill: 'none', stroke: c.cut, 'stroke-width': 1.9, 'stroke-linecap': 'round' });
  }
  return `<g transform="translate(${n(x)},${n(y)})">${out}</g>`;
}
