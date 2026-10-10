import { ChildRelation, FamilyKind } from '../model/types';

export interface Pt {
  x: number;
  y: number;
}

export interface LayoutOptions {
  cardWidth: number;
  cardHeight: number;
  /** Space between two partners; the union marker sits in it. */
  partnerGap: number;
  /** Space between siblings. */
  siblingGap: number;
  /** Space between unrelated neighbours in a row. */
  familyGap: number;
  /** Space between separate trees. */
  componentGap: number;
  /** Vertical space between generations, before extra line tracks. */
  rowGap: number;
  /** Distance between stacked horizontal lines in one gap. */
  trackGap: number;
  /** Radius of the marker for parents nobody has entered yet. */
  placeholderRadius: number;
  /** Radius of the union marker between partners. */
  junctionRadius: number;
}

export const COMFORTABLE_LAYOUT: LayoutOptions = {
  cardWidth: 188,
  cardHeight: 70,
  partnerGap: 44,
  siblingGap: 22,
  familyGap: 48,
  componentGap: 140,
  rowGap: 78,
  trackGap: 11,
  placeholderRadius: 11,
  junctionRadius: 7,
};

export const COMPACT_LAYOUT: LayoutOptions = {
  cardWidth: 156,
  cardHeight: 56,
  partnerGap: 36,
  siblingGap: 16,
  familyGap: 36,
  componentGap: 110,
  rowGap: 62,
  trackGap: 9,
  placeholderRadius: 10,
  junctionRadius: 6,
};

/** Extra card height when places are shown. */
export const PLACE_LINE_HEIGHT = 14;

export interface LayoutCard {
  personId: string;
  /** Top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  rank: number;
}

/** Parents who are not entered yet, drawn as a small dashed circle. */
export interface LayoutPlaceholder {
  familyId: string;
  cx: number;
  cy: number;
  r: number;
  rank: number;
}

/**
 * How a family's partners are drawn:
 * - gap: partners side by side, marker between them
 * - bridge: partners in one row with someone between them; the line arches over
 * - single: one known parent; children hang from the card
 * - none: no known parents; children hang from a placeholder
 * - split: partners in different generations
 */
export type UnionMode = 'gap' | 'bridge' | 'single' | 'none' | 'split';

export interface LayoutUnion {
  familyId: string;
  mode: UnionMode;
  kind: FamilyKind;
  /** Divorce, separation or annulment. */
  ended: boolean;
  /** Centre of the union marker, or the point children hang from. */
  cx: number;
  cy: number;
  /** The line between partners as a polyline. Empty when there is no partner line. */
  line: Pt[];
  rank: number;
}

export interface LayoutDrop {
  childId: string;
  relation: ChildRelation;
  /** Where the drop leaves the horizontal bar. */
  x: number;
  /** Points after the bar; the last one is the top centre of the child's card. */
  points: Pt[];
}

/** The lines from a family to its children: a stem, a bar and one drop per child. */
export interface LayoutConnector {
  familyId: string;
  stem: Pt;
  barY: number;
  drops: LayoutDrop[];
}

/** A secondary parent link (for example adoptive parents when birth parents are also known). */
export interface LayoutLink {
  familyId: string;
  childId: string;
  relation: ChildRelation;
  from: Pt;
  to: Pt;
}

export interface LayoutRow {
  rank: number;
  y: number;
  h: number;
  /** Generation number in Roman numerals, oldest first. */
  label: string;
}

export interface LayoutBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  cards: LayoutCard[];
  placeholders: LayoutPlaceholder[];
  unions: LayoutUnion[];
  connectors: LayoutConnector[];
  links: LayoutLink[];
  rows: LayoutRow[];
  bounds: LayoutBounds;
  /** Generation index of every person (0 = top row). */
  ranks: ReadonlyMap<string, number>;
  /** Number of line crossings left after optimisation (for tests and tuning). */
  crossings: number;
}

export function toRoman(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
