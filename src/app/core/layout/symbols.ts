/** Small symbols drawn on cards, as SVG path data centred on 0,0 in a box `s` wide. */
import { Sex } from '../model/types';

const r1 = (v: number) => Math.round(v * 100) / 100;

function circle(cx: number, cy: number, r: number): string {
  return `M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 1,0 ${r1(r * 2)},0a${r1(r)},${r1(r)} 0 1,0 ${r1(-r * 2)},0`;
}

/** ♂ ♀ and a combined sign for other; nothing when sex is not recorded. Draw with a stroke. */
export function sexSymbolPath(sex: Sex, s: number): string {
  switch (sex) {
    case 'male':
      return (
        circle(-0.12 * s, 0.12 * s, 0.3 * s) +
        `M${r1(0.1 * s)},${r1(-0.1 * s)}L${r1(0.42 * s)},${r1(-0.42 * s)}` +
        `M${r1(0.17 * s)},${r1(-0.42 * s)}H${r1(0.42 * s)}V${r1(-0.17 * s)}`
      );
    case 'female':
      return circle(0, -0.14 * s, 0.3 * s) + `M0,${r1(0.16 * s)}V${r1(0.5 * s)}` + `M${r1(-0.16 * s)},${r1(0.34 * s)}H${r1(0.16 * s)}`;
    case 'other':
      return (
        circle(-0.06 * s, 0, 0.24 * s) +
        `M${r1(0.12 * s)},${r1(-0.18 * s)}L${r1(0.42 * s)},${r1(-0.46 * s)}` +
        `M${r1(0.2 * s)},${r1(-0.46 * s)}H${r1(0.42 * s)}V${r1(-0.24 * s)}` +
        `M${r1(-0.06 * s)},${r1(0.24 * s)}V${r1(0.5 * s)}M${r1(-0.19 * s)},${r1(0.38 * s)}H${r1(0.07 * s)}`
      );
    default:
      return '';
  }
}
