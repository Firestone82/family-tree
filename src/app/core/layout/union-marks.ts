/**
 * The marker on the line between partners, as shapes around (0,0): interlocked
 * rings for a marriage, one ring for partners, a ring with a stone for an
 * engagement. When a couple broke up the rings come apart, and a divorce or an
 * annulment adds a slash across them. The chart and the print styles draw
 * these shapes in their own colours.
 */
import { RelationshipStatus } from '../model/relationship';
import { FamilyKind } from '../model/types';

export interface MarkRing {
  cx: number;
  cy: number;
  r: number;
}

export interface UnionMark {
  /** What kind of union the marker shows. */
  kind: 'marriage' | 'engaged' | 'partnership' | 'unknown';
  /** The couple separated, divorced or ended the relationship: the rings are drawn apart. */
  apart: boolean;
  /** The plate behind the rings, a rounded rectangle (a circle when w = h = 2·rx). */
  plate: { x: number; y: number; w: number; h: number; rx: number };
  rings: MarkRing[];
  /** The stone of an engagement ring, as path data. */
  stone?: string;
  /** Radius of the dot shown when the kind of relationship is not known. */
  dot?: number;
  /** A slash across the marker, as path data: divorced, annulled, or a partnership that ended. */
  slash?: string;
}

const r1 = (v: number) => Math.round(v * 100) / 100;

/** The marker for a couple, sized by the ring radius `r`. */
export function unionMark(kind: FamilyKind, status: RelationshipStatus, r: number): UnionMark {
  const pad = 1.6;
  const pill = (halfW: number) => ({ x: -halfW, y: -r - pad, w: halfW * 2, h: r * 2 + pad * 2, rx: r + pad });
  const circle = (radius: number) => ({ x: -radius, y: -radius, w: radius * 2, h: radius * 2, rx: radius });
  // A slash leaning right, a little taller than the plate so it reads as a cut.
  const slash = (h: number) => `M${r1(h * 0.42)},${r1(-h)}L${r1(-h * 0.42)},${r1(h)}`;
  const apart = status === 'separated' || status === 'divorced' || status === 'annulled' || status === 'ended';
  const cut = status === 'divorced' || status === 'annulled' || status === 'ended';

  if (status === 'engaged') {
    const s = r;
    return {
      kind: 'engaged',
      apart: false,
      plate: circle(r + pad),
      rings: [{ cx: 0, cy: r1(r * 0.25), r: r1(r * 0.85) }],
      stone: `M0,${r1(-s * 1.25)}l${r1(s * 0.42)},${r1(s * 0.45)}l${r1(-s * 0.42)},${r1(s * 0.45)}l${r1(-s * 0.42)},${r1(-s * 0.45)}Z`,
    };
  }
  if (kind === 'marriage') {
    if (!apart)
      return {
        kind: 'marriage',
        apart,
        plate: pill(r * 1.95),
        rings: [
          { cx: r1(-r * 0.62), cy: 0, r },
          { cx: r1(r * 0.62), cy: 0, r },
        ],
      };
    // The two rings no longer touch.
    const gap = r * 1.22;
    return {
      kind: 'marriage',
      apart,
      plate: pill(gap + r + pad + 0.4),
      rings: [
        { cx: r1(-gap), cy: 0, r: r1(r * 0.92) },
        { cx: r1(gap), cy: 0, r: r1(r * 0.92) },
      ],
      slash: cut ? slash(r + pad + 1.6) : undefined,
    };
  }
  if (kind === 'partnership') {
    return { kind: 'partnership', apart, plate: circle(r + pad), rings: [{ cx: 0, cy: 0, r }], slash: apart ? slash(r + pad + 1.6) : undefined };
  }
  return { kind: 'unknown', apart, plate: circle(r), rings: [], dot: 2.4, slash: apart ? slash(r + 1.6) : undefined };
}
