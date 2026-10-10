/**
 * Types for printed and exported pages ("posters"). A print style is a
 * PosterTheme: colours, fonts, card measurements and a few drawing functions
 * for the page around the tree. See themes/ for the styles and README.md for
 * how to add one.
 */
import { LegendEntry, Tincture } from '../colors/tinctures';
import { Kin } from '../kinship/kinship';
import { ChartLanguage } from '../lang/language';
import { LayoutCard, LayoutOptions, LayoutResult, LayoutUnion } from '../layout/layout-types';
import { RelationshipStatus } from '../model/relationship';
import { TreeIndex } from '../model/tree-index';
import { Person, PrintSettings, TreeDocument } from '../model/types';

export interface FontSpec {
  /** CSS font-family list; only the bundled faces (Alegreya, Alegreya SC, Alegreya Sans) are embedded in exports. */
  family: string;
  size: number;
  weight?: number;
  style?: 'normal' | 'italic';
  /** In em. */
  letterSpacing?: number;
}

/** A line of text on a person card; `step` is the distance from the line above (baseline to baseline). */
export interface CardLine extends FontSpec {
  step: number;
}

export interface PosterPalette {
  paper: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  card: string;
  cardEdge: string;
  /** Relationship names on the cards. */
  kin: string;
  /** Card backgrounds when cards are tinted by sex. */
  cardMale: string;
  cardFemale: string;
  /** The sex symbols. */
  male: string;
  female: string;
  /** The slash across the rings of a couple who divorced. */
  break: string;
}

/** Colours of the tree drawn behind the chart. */
export interface PosterTreeStyle {
  /** Trunk, branches and roots. */
  wood: string;
  /** Bark lines along the thicker wood. */
  bark?: string;
  /** Masses of leaves: the shaded underside, the body, the light on top. */
  canopy: readonly [string, string, string];
  /** Single leaves, darkest first (up to four tones; fewer are repeated). */
  leaves: readonly string[];
  /** Opacity of the whole tree, so the chart in front stays easy to read. */
  opacity: number;
}

/** What a card looks like besides its outline. */
export interface CardLook {
  /** In the middle of the page. */
  focus: boolean;
  /** Background colour (tinted by sex when that is on). */
  fill: string;
}

export interface PosterCardStyle {
  width: number;
  radius: number;
  /** Where the text starts, from the card's left edge. */
  textX: number;
  padRight: number;
  /** Space above the first line's capitals and below the last baseline. */
  top: number;
  bottom: number;
  badge: { kind: 'shield' | 'seal' | 'bar' | 'none'; x: number; size: number; font: FontSpec };
  photoRadius: number;
  kin: CardLine;
  given: CardLine;
  surname: CardLine;
  /** The surname at birth, under the surname: "née Barlow". */
  birth: CardLine;
  dates: CardLine;
  place: CardLine;
}

/** Which optional lines the cards have. Every card has the same lines, so rows line up. */
export interface CardLines {
  kin: boolean;
  birth: boolean;
  dates: boolean;
  place: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A block of the page above or below the tree (title, legend, captions). */
export interface PageBlock {
  height: number;
  draw(rect: Rect): string;
}

/** Text already fitted to a card. */
export interface CardText {
  kin: string;
  given: string;
  surname: string;
  birth: string;
  dates: string;
  place: string;
  initials: string;
}

export interface PosterContext {
  theme: PosterTheme;
  settings: PrintSettings;
  language: ChartLanguage;
  /** The part of the tree being printed. */
  doc: TreeDocument;
  index: TreeIndex;
  /** Geometry in chart units, already turned upside down for styles that grow upwards. */
  layout: LayoutResult;
  options: LayoutOptions;
  page: {
    w: number;
    h: number;
    /** 1% of the page's shorter side; decorations scale with it. */
    u: number;
    /** Space between the paper's edge and the content. */
    margin: number;
  };
  chart: Rect;
  scale: number;
  colors: ReadonlyMap<string, Tincture>;
  legend: readonly LegendEntry[];
  kin: ReadonlyMap<string, Kin>;
  texts: ReadonlyMap<string, CardText>;
  /** Which optional lines the cards have. */
  lines: CardLines;
  /** The person in the middle and their partner. */
  focusIds: readonly string[];
  /** The couple in the middle and all their ancestors (the roots, in a tree that grows upwards). */
  rootIds: ReadonlySet<string>;
  title: string;
  subtitle: string;
  /** First and last year in the print, when known. */
  years?: { from: number; to: number };
  now: Date;
  measure(text: string, font: FontSpec): number;
  fit(text: string, font: FontSpec, max: number): string;
  /** Adds to <defs> once per id. */
  def(id: string, markup: string): void;
  person(id: string): Person | undefined;
  status(familyId: string): RelationshipStatus;
}

export interface PosterTheme {
  id: string;
  name: string;
  description: string;
  /** 'up' puts the oldest generation at the bottom, like roots, and the youngest at the top. */
  flow: 'down' | 'up';
  palette: PosterPalette;
  tinctures: Record<Tincture, { fill: string; ink: string; edge?: string }>;
  card: PosterCardStyle;
  spacing: Partial<LayoutOptions>;
  line: { style: 'square' | 'curved' | 'branch'; width: number; radius: number };
  /** The tree drawn behind the chart. */
  tree: PosterTreeStyle;
  unionFont: FontSpec;
  generationFont: FontSpec;
  /** Page margin as a share of the page's shorter side. */
  margin: number;
  /** Faces to load before measuring, as CSS font shorthand. */
  fonts: readonly string[];
  /** A tiny picture of the style for the style picker: background, ink, accent. */
  swatch: readonly [string, string, string];

  background(c: PosterContext): string;
  header(c: PosterContext): PageBlock;
  footer(c: PosterContext): PageBlock;
  /** Drawn over everything (frame ornaments). */
  overlay?(c: PosterContext): string;
  cardShape?(c: PosterContext, card: LayoutCard, look: CardLook): string;
  /** All parent-child lines; the default draws square or curved lines. */
  connectors?(c: PosterContext): string;
  unionMarker?(c: PosterContext, union: LayoutUnion, x: number, y: number): string;
  /** Marks the couple in the middle. */
  focus?(c: PosterContext, rect: Rect): string;
  generationLabel?(c: PosterContext, label: string, x: number, y: number, index: number): string;
}
