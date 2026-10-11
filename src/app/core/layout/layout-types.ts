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
  /**
   * Space between neighbouring families in a row that are first cousins'; more
   * distant families get more (see gapBetweenFamilies in layout.ts).
   */
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
  familyGap: 64,
  componentGap: 140,
  rowGap: 78,
  trackGap: 11,
  placeholderRadius: 11,
  junctionRadius: 7,
};

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
  /**
   * For a line to a child more than one row down: the rows it passes on the
   * way, in order, with where it runs between their cards (x) and where it
   * enters and leaves each row (y). A curved line turns only between them.
   */
  through?: LayoutPass[];
}

/** Where a line passes a row between its cards: straight down at `x`, from `from` to `to`. */
export interface LayoutPass {
  x: number;
  from: number;
  to: number;
}

/** The lines from a family to its children: a stem, a bar and one drop per child. */
export interface LayoutConnector {
  familyId: string;
  stem: Pt;
  /** Where the parents' row ends below the stem. A line that turns only past it cannot run behind a card in that row. */
  clearY: number;
  barY: number;
  drops: LayoutDrop[];
}

/** A secondary parent link (for example adoptive parents when birth parents are also known). */
export interface LayoutLink {
  familyId: string;
  childId: string;
  relation: ChildRelation;
  from: Pt;
  /** Where the parents' row ends below `from` (see LayoutConnector). */
  clearY: number;
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
  /**
   * Rows between the generations, with no generation number of their own: for
   * the family of someone who married in, when their own generation's row has
   * no room for it near them, or for a couple from two families, whose
   * families' lines can then come down past the rest of their generation.
   */
  lanes: LayoutRow[];
  bounds: LayoutBounds;
  /** Generation index of every person (0 = top row). */
  ranks: ReadonlyMap<string, number>;
  /** Number of line crossings left after optimisation (for tests and tuning). */
  crossings: number;
  /**
   * Where the layout put everyone and the lines between rows, before any moves
   * by hand: given to the next layout as its hint, so the chart keeps its order.
   */
  hint?: ReadonlyMap<string, number>;
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
