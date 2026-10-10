/**
 * Modern: a clean chart on white paper. One sans-serif family, fine square
 * lines, round initials in the family colours and a single blue accent.
 */
import { LayoutCard, LayoutUnion } from '../../layout/layout-types';
import { yearSpan } from '../../lang/language';
import { CardLook, FontSpec, PageBlock, PosterContext, PosterTheme, Rect, UNKNOWN_DASH } from '../poster-types';
import { unionMark } from '../../layout/union-marks';
import { drawMark } from '../marks';
import { el, fontAttrs, n, text } from '../svg';
import { SANS } from './fonts';

const palette = {
  paper: '#ffffff',
  ink: '#15181c',
  muted: '#4c535d',
  faint: '#7e858e',
  line: '#2a2f36',
  accent: '#2456c4',
  card: '#ffffff',
  cardEdge: '#d3d8de',
  kin: '#2456c4',
  cardMale: '#edf3fe',
  cardFemale: '#fdeef2',
  male: '#2f62c9',
  female: '#c8406c',
  break: '#c63b2b',
};

export const modern: PosterTheme = {
  id: 'modern',
  name: 'Modern',
  description: 'White paper, fine lines and plenty of space.',
  flow: 'down',
  palette,
  swatch: [palette.paper, palette.ink, palette.accent],
  tinctures: {
    azure: { fill: '#2f62c9', ink: '#ffffff' },
    gules: { fill: '#cf4a3c', ink: '#ffffff' },
    vert: { fill: '#2c8f5d', ink: '#ffffff' },
    purpure: { fill: '#7650c2', ink: '#ffffff' },
    or: { fill: '#e0a22a', ink: '#15181c' },
    tenne: { fill: '#de772d', ink: '#ffffff' },
    sanguine: { fill: '#c13c72', ink: '#ffffff' },
    celeste: { fill: '#2b98c0', ink: '#ffffff' },
    sable: { fill: '#3b4047', ink: '#ffffff' },
    argent: { fill: '#e8ebee', ink: '#4c535d' },
  },
  card: {
    width: 190,
    radius: 6,
    textX: 48,
    padRight: 10,
    top: 11,
    bottom: 11,
    badge: { kind: 'seal', x: 11, size: 28, font: { family: SANS, size: 10.5, weight: 700, letterSpacing: 0.02 } },
    photoRadius: 14,
    kin: { family: SANS, size: 10.5, weight: 500, step: 0 },
    given: { family: SANS, size: 15, weight: 700, step: 17 },
    surname: { family: SANS, size: 13, weight: 400, step: 16 },
    birth: { family: SANS, size: 11.5, weight: 400, step: 14.5 },
    dates: { family: SANS, size: 11.5, weight: 400, step: 15.5 },
    place: { family: SANS, size: 11, weight: 400, step: 14 },
  },
  spacing: { partnerGap: 44, siblingGap: 22, familyGap: 64, rowGap: 82 },
  line: { style: 'square', width: 1.15, radius: 0 },
  tree: { wood: '#d4c9bb', bark: '#c2b4a4', canopy: ['#d3e9ce', '#e0f0dc', '#edf6ea'], leaves: ['#98c78b', '#acd4a0', '#c0dfb6', '#d2e8ca'], opacity: 1 },
  unionFont: { family: SANS, size: 10.5 },
  generationFont: { family: SANS, size: 13, weight: 700 },
  margin: 0.06,
  fonts: ["400 16px 'Alegreya Sans'", "500 16px 'Alegreya Sans'", "700 16px 'Alegreya Sans'"],

  background(c) {
    return el('rect', { width: c.page.w, height: c.page.h, fill: palette.paper });
  },

  header(c): PageBlock {
    const u = c.page.u;
    const titleFont: FontSpec = { family: SANS, size: u * 4.6, weight: 700, letterSpacing: -0.01 };
    const subFont: FontSpec = { family: SANS, size: u * 1.6 };
    const legendFont: FontSpec = { family: SANS, size: u * 1.25 };
    const height = titleFont.size + (c.subtitle ? u * 1 + subFont.size : 0) + u * 3.4;
    return {
      height,
      draw(r: Rect) {
        const legend = c.legend;
        // Legend on the right, in up to two rows; the title takes what is left.
        const items = legend.map((l) => ({ l, w: u * 1.6 + c.measure(l.label, legendFont) }));
        const rowW = Math.min(
          r.w * 0.42,
          items.reduce((s, i) => s + i.w + u * 1.6, 0),
        );
        const rows: (typeof items)[] = [[]];
        let used = 0;
        for (const it of items) {
          if (used + it.w > rowW && rows[rows.length - 1].length) {
            if (rows.length === 2) break;
            rows.push([]);
            used = 0;
          }
          rows[rows.length - 1].push(it);
          used += it.w + u * 1.6;
        }
        let out = '';
        rows.forEach((row, ri) => {
          let x = r.x + r.w;
          const y = r.y + u * 1.4 + ri * legendFont.size * 1.7;
          for (const it of [...row].reverse()) {
            x -= it.w;
            const t = c.theme.tinctures[it.l.tincture];
            out += el('circle', { cx: x + u * 0.5, cy: y - legendFont.size * 0.33, r: u * 0.5, fill: t.fill });
            out += el('text', { x: x + u * 1.4, y, ...fontAttrs(legendFont), fill: palette.muted }, text(it.l.label));
            x -= u * 1.6;
          }
        });
        const titleMax = r.w - (items.length ? rowW + u * 4 : 0);
        out += el('text', { x: r.x, y: r.y + titleFont.size * 0.8, ...fontAttrs(titleFont), fill: palette.ink }, text(c.fit(c.title, titleFont, titleMax)));
        if (c.subtitle) {
          out += el(
            'text',
            { x: r.x, y: r.y + titleFont.size + u * 1 + subFont.size * 0.8, ...fontAttrs(subFont), fill: palette.muted },
            text(c.fit(c.subtitle, subFont, titleMax)),
          );
        }
        out += el('path', { d: `M${n(r.x)},${n(r.y + r.h - u * 1.2)}H${n(r.x + r.w)}`, stroke: palette.ink, 'stroke-width': u * 0.12 });
        return out;
      },
    };
  },

  footer(c): PageBlock {
    const u = c.page.u;
    const font: FontSpec = { family: SANS, size: u * 1.15 };
    return {
      height: u * 3,
      draw(r: Rect) {
        const y = r.y + r.h - u * 0.4;
        let out = el('path', { d: `M${n(r.x)},${n(r.y + u * 0.6)}H${n(r.x + r.w)}`, stroke: palette.cardEdge, 'stroke-width': u * 0.08 });
        out += el('text', { x: r.x, y, ...fontAttrs(font), fill: palette.faint }, text(c.language.drawn(c.now)));
        if (c.years)
          out += el('text', { x: r.x + r.w, y, 'text-anchor': 'end', ...fontAttrs(font), fill: palette.faint }, text(yearSpan(c.years.from, c.years.to)));
        return out;
      },
    };
  },

  cardShape(c, card: LayoutCard, look: CardLook) {
    return el('rect', {
      x: 0.5,
      y: 0.5,
      width: card.w - 1,
      height: card.h - 1,
      rx: modern.card.radius,
      fill: look.fill,
      stroke: look.focus ? palette.accent : palette.cardEdge,
      'stroke-width': look.focus ? 2 : 1,
      'stroke-dasharray': look.unknown ? UNKNOWN_DASH : undefined,
    });
  },

  unionMarker(c: PosterContext, u: LayoutUnion, x: number, y: number) {
    const status = c.status(u.familyId);
    const mark = unionMark(u.kind, status, 3.6);
    // A couple who broke up: two hollow rings apart, with a red cut for a divorce.
    if (mark.apart) return drawMark(mark, x, y, { plate: palette.paper, ring: palette.muted, ringWidth: 1.2, dot: palette.faint, cut: palette.break });
    let inner: string;
    if (u.kind === 'marriage') inner = el('circle', { r: 4.2, fill: palette.ink });
    else if (status === 'engaged' || u.kind === 'partnership') inner = el('circle', { r: 4, fill: palette.paper, stroke: palette.ink, 'stroke-width': 1.4 });
    else inner = el('circle', { r: 2.6, fill: palette.faint });
    return `<g transform="translate(${n(x)},${n(y)})">${inner}</g>`;
  },

  focus(c, r) {
    return el('rect', { x: r.x - 2, y: r.y - 2, width: r.w + 4, height: r.h + 4, rx: 10, fill: '#eef3fd', stroke: 'none' });
  },

  generationLabel(c, label, x, y, index) {
    return el(
      'text',
      { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(modern.generationFont), fill: palette.accent },
      text(String(index + 1)),
    );
  },
};
