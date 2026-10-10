/**
 * Heirloom: a family register on vellum. Iron-gall ink, an oxblood double
 * frame with corner flourishes, the title on a ribbon, engraved name plates
 * and gold rings for marriages.
 */
import { LayoutCard, LayoutUnion } from '../../layout/layout-types';
import { yearSpan } from '../../lang/language';
import { CardLook, FontSpec, PageBlock, PosterContext, PosterTheme, Rect, UNKNOWN_DASH } from '../poster-types';
import { unionMark } from '../../layout/union-marks';
import { drawMark } from '../marks';
import { el, fontAttrs, n, shieldPath, specklePattern, text } from '../svg';
import { SANS, SERIF, SMALL_CAPS } from './fonts';

const VELLUM_LIGHT = '#f6eedb';
const RIBBON = '#f3e7cb';
const RIBBON_SHADE = '#e2cfa6';
const RIBBON_FOLD = '#c6aa78';
const GOLD = '#a47d35';

const palette = {
  paper: '#eee1c3',
  ink: '#2e2117',
  muted: '#5c4733',
  faint: '#836c55',
  line: '#4b3828',
  accent: '#7b2c23',
  card: '#f8f1df',
  cardEdge: '#8b7255',
  kin: '#7b2c23',
  cardMale: '#e2e8ee',
  cardFemale: '#f4e0db',
  male: '#2f4e7a',
  female: '#8e2e45',
  break: '#9c2f22',
};

export const heirloom: PosterTheme = {
  id: 'heirloom',
  name: 'Heirloom',
  description: 'Vellum, an ornamental frame, the title on a ribbon and engraved name plates.',
  flow: 'down',
  palette,
  swatch: [palette.paper, palette.ink, palette.accent],
  tinctures: {
    azure: { fill: '#2f4e7a', ink: VELLUM_LIGHT },
    gules: { fill: '#8e2e28', ink: VELLUM_LIGHT },
    vert: { fill: '#3d6744', ink: VELLUM_LIGHT },
    purpure: { fill: '#5a4376', ink: VELLUM_LIGHT },
    or: { fill: '#b98a2f', ink: '#2e2117' },
    tenne: { fill: '#a35727', ink: VELLUM_LIGHT },
    sanguine: { fill: '#782c42', ink: VELLUM_LIGHT },
    celeste: { fill: '#4d7c99', ink: VELLUM_LIGHT },
    sable: { fill: '#3a3029', ink: VELLUM_LIGHT },
    argent: { fill: VELLUM_LIGHT, ink: '#4b3828', edge: '#8b7255' },
  },
  card: {
    width: 200,
    radius: 3,
    textX: 50,
    padRight: 12,
    top: 10,
    bottom: 11,
    badge: { kind: 'shield', x: 14, size: 24, font: { family: SANS, size: 10, weight: 700, letterSpacing: 0.02 } },
    photoRadius: 16,
    kin: { family: SMALL_CAPS, size: 10, weight: 500, letterSpacing: 0.07, step: 0 },
    given: { family: SERIF, size: 16, weight: 600, step: 17 },
    surname: { family: SMALL_CAPS, size: 13.5, weight: 500, letterSpacing: 0.02, step: 16.5 },
    birth: { family: SMALL_CAPS, size: 11.5, weight: 500, letterSpacing: 0.02, step: 14.5 },
    dates: { family: SERIF, size: 12, weight: 400, step: 16 },
    place: { family: SERIF, size: 11.5, weight: 400, style: 'italic', step: 14.5 },
  },
  spacing: { partnerGap: 48, siblingGap: 24, familyGap: 68, rowGap: 86 },
  line: { style: 'square', width: 1.3, radius: 9 },
  tree: { wood: '#ac8d61', bark: '#86683f', canopy: ['#c6cf9a', '#d5dbae', '#e3e6c3'], leaves: ['#7c9750', '#91a961', '#a5b974', '#b9c889'], opacity: 1 },
  unionFont: { family: SERIF, size: 11.5, style: 'italic' },
  generationFont: { family: SMALL_CAPS, size: 13, weight: 500, letterSpacing: 0.06 },
  margin: 0.05,
  fonts: ["600 16px 'Alegreya Variable'", "italic 400 16px 'Alegreya Variable'", "500 16px 'Alegreya SC'", "700 16px 'Alegreya Sans'"],

  background(c) {
    const { w, h } = c.page;
    c.def('pp-hl-specks', specklePattern('pp-hl-specks', 160, '#6b4b24', 110, 11, 0.9, 0.2));
    c.def(
      'pp-hl-vignette',
      '<radialGradient id="pp-hl-vignette" cx="50%" cy="46%" r="74%"><stop offset="58%" stop-color="#a98446" stop-opacity="0"/><stop offset="100%" stop-color="#8e6b35" stop-opacity="0.36"/></radialGradient>',
    );
    const f = frame(c);
    return (
      el('rect', { width: w, height: h, fill: palette.paper }) +
      el('rect', { width: w, height: h, fill: 'url(#pp-hl-specks)' }) +
      el('rect', { width: w, height: h, fill: 'url(#pp-hl-vignette)' }) +
      el('rect', { x: f.outer.x, y: f.outer.y, width: f.outer.w, height: f.outer.h, fill: 'none', stroke: palette.accent, 'stroke-width': c.page.u * 0.26 }) +
      el('rect', { x: f.inner.x, y: f.inner.y, width: f.inner.w, height: f.inner.h, fill: 'none', stroke: palette.accent, 'stroke-width': c.page.u * 0.08 })
    );
  },

  header(c): PageBlock {
    const u = c.page.u;
    const titleFont: FontSpec = { family: SMALL_CAPS, size: u * 3.9, weight: 500, letterSpacing: 0.06 };
    const subFont: FontSpec = { family: SERIF, size: u * 1.6, style: 'italic' };
    const bannerH = titleFont.size * 1.75;
    const height = bannerH + (c.subtitle ? u * 1.3 + subFont.size : 0) + u * 3.6;
    return {
      height,
      draw(r: Rect) {
        const cx = r.x + r.w / 2;
        const maxText = r.w * 0.72 - bannerH * 1.6;
        const tw = c.measure(c.title, titleFont);
        const font = tw > maxText ? { ...titleFont, size: (titleFont.size * maxText) / tw } : titleFont;
        const bw = Math.min(tw, maxText) + bannerH * 1.6;
        let out = ribbon(cx, r.y, bw, bannerH, u);
        out += el(
          'text',
          { x: cx, y: r.y + bannerH * 0.53, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(font), fill: palette.accent },
          text(c.title),
        );
        let y = r.y + bannerH;
        if (c.subtitle) {
          y += u * 1.3 + subFont.size * 0.8;
          out += el('text', { x: cx, y, 'text-anchor': 'middle', ...fontAttrs(subFont), fill: palette.muted }, text(c.subtitle));
          y += subFont.size * 0.2;
        }
        out += divider(cx, y + u * 1.5, u);
        return out;
      },
    };
  },

  footer(c): PageBlock {
    const u = c.page.u;
    const legendFont: FontSpec = { family: SMALL_CAPS, size: u * 1.25, weight: 500, letterSpacing: 0.04 };
    const capFont: FontSpec = { family: SERIF, size: u * 1.1, style: 'italic' };
    const legend = c.legend.filter((l) => l.key !== '' || c.legend.length > 1);
    const height = (legend.length ? u * 3.4 : 0) + u * 2.4;
    return {
      height,
      draw(r: Rect) {
        let out = '';
        if (legend.length) {
          const shieldW = u * 1.3;
          const gap = u * 2.2;
          const items = legend.map((l) => ({ l, w: shieldW + u * 0.6 + c.measure(l.label, legendFont) }));
          let total = items.reduce((s, i) => s + i.w, 0) + gap * (items.length - 1);
          while (total > r.w && items.length > 1) total -= items.pop()!.w + gap;
          let x = r.x + (r.w - total) / 2;
          const y = r.y + u * 1.4;
          for (const { l, w } of items) {
            const t = c.theme.tinctures[l.tincture];
            out += `<g transform="translate(${n(x)},${n(y - shieldW * 0.62)})">${el('path', { d: shieldPath(shieldW, shieldW * 1.18), fill: t.fill, stroke: t.edge, 'stroke-width': t.edge ? 0.6 : undefined })}</g>`;
            out += el('text', { x: x + shieldW + u * 0.6, y: y + legendFont.size * 0.32, ...fontAttrs(legendFont), fill: palette.muted }, text(l.label));
            x += w + gap;
          }
        }
        const caption = [c.language.drawn(c.now), c.years ? yearSpan(c.years.from, c.years.to) : ''].filter(Boolean).join(', ');
        out += el('text', { x: r.x + r.w / 2, y: r.y + r.h - u * 0.5, 'text-anchor': 'middle', ...fontAttrs(capFont), fill: palette.faint }, text(caption));
        return out;
      },
    };
  },

  overlay(c) {
    const f = frame(c).inner;
    const u = c.page.u;
    const s = u * 5.2;
    const corner = (x: number, y: number, sx: number, sy: number) =>
      `<g transform="translate(${n(x)},${n(y)}) scale(${(sx * s) / 50},${(sy * s) / 50})">${cornerOrnament()}</g>`;
    return (
      corner(f.x, f.y, 1, 1) +
      corner(f.x + f.w, f.y, -1, 1) +
      corner(f.x, f.y + f.h, 1, -1) +
      corner(f.x + f.w, f.y + f.h, -1, -1) +
      edgeOrnament(f.x + f.w / 2, f.y + f.h, u)
    );
  },

  cardShape(c, card: LayoutCard, look: CardLook) {
    const focus = look.focus;
    const k = 5;
    const plate = (inset: number) => {
      const w = card.w - inset * 2;
      const h = card.h - inset * 2;
      const kk = Math.max(1, k - inset * 0.6);
      return `M${n(inset + kk)},${n(inset)}H${n(inset + w - kk)}L${n(inset + w)},${n(inset + kk)}V${n(inset + h - kk)}L${n(inset + w - kk)},${n(inset + h)}H${n(inset + kk)}L${n(inset)},${n(inset + h - kk)}V${n(inset + kk)}Z`;
    };
    return (
      el('path', {
        d: plate(0),
        fill: look.fill,
        stroke: focus ? palette.accent : palette.cardEdge,
        'stroke-width': focus ? 1.5 : 0.9,
        'stroke-dasharray': look.unknown ? UNKNOWN_DASH : undefined,
      }) +
      // Someone whose name nobody knows has no inner rule, only the dashed edge.
      (look.unknown ? '' : el('path', { d: plate(3), fill: 'none', stroke: palette.cardEdge, 'stroke-width': 0.4, opacity: 0.85 }))
    );
  },

  unionMarker(c: PosterContext, u: LayoutUnion, x: number, y: number) {
    // Gold rings on a vellum oval; a couple who broke up have them apart, cut with oxblood for a divorce.
    const mark = unionMark(u.kind, c.status(u.familyId), 4.8);
    if (mark.kind === 'marriage') mark.plate = { ...mark.plate, x: mark.plate.x - 0.6, w: mark.plate.w + 1.2 };
    return drawMark(mark, x, y, { plate: palette.paper, ring: GOLD, ringApart: palette.faint, ringWidth: 1.45, dot: palette.line, cut: palette.break });
  },

  focus(c, r) {
    return (
      el('rect', { x: r.x - 4, y: r.y - 4, width: r.w + 8, height: r.h + 8, rx: 5, fill: 'none', stroke: GOLD, 'stroke-width': 0.6 }) +
      el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 3, fill: 'none', stroke: GOLD, 'stroke-width': 1.5 }) +
      `<g transform="translate(${n(r.x + r.w / 2)},${n(r.y - 4)})">${el('path', { d: 'M0,-6L5,0L0,6L-5,0Z', fill: GOLD })}${el('path', { d: 'M-16,0H-8M8,0H16', stroke: GOLD, 'stroke-width': 0.9 })}</g>`
    );
  },

  generationLabel(c, label, x, y) {
    return (
      el('circle', { cx: x, cy: y, r: 14, fill: 'none', stroke: palette.accent, 'stroke-width': 0.8 }) +
      el('circle', { cx: x, cy: y, r: 11.5, fill: 'none', stroke: palette.accent, 'stroke-width': 0.35 }) +
      el(
        'text',
        { x, y: y + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(heirloom.generationFont), fill: palette.accent },
        text(label),
      )
    );
  },
};

function frame(c: PosterContext): { outer: Rect; inner: Rect } {
  const { w, h, u, margin: m } = c.page;
  const o = m * 0.42;
  const i = o + u * 0.75;
  return {
    outer: { x: o, y: o, w: w - o * 2, h: h - o * 2 },
    inner: { x: i, y: i, w: w - i * 2, h: h - i * 2 },
  };
}

/** A ribbon banner with swallowtail ends folded behind. */
function ribbon(cx: number, y: number, w: number, h: number, u: number): string {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const d = h * 0.32;
  const tail = h * 1.15;
  const notch = h * 0.42;
  const stroke = { stroke: palette.accent, 'stroke-width': u * 0.13, 'stroke-linejoin': 'round' as const };
  const left = `M${n(x0 + h * 0.5)},${n(y + d)}L${n(x0 - tail)},${n(y + d)}L${n(x0 - tail + notch)},${n(y + d + h / 2)}L${n(x0 - tail)},${n(y + d + h)}L${n(x0 + h * 0.5)},${n(y + d + h)}Z`;
  const right = `M${n(x1 - h * 0.5)},${n(y + d)}L${n(x1 + tail)},${n(y + d)}L${n(x1 + tail - notch)},${n(y + d + h / 2)}L${n(x1 + tail)},${n(y + d + h)}L${n(x1 - h * 0.5)},${n(y + d + h)}Z`;
  const foldL = `M${n(x0)},${n(y + h)}L${n(x0 + h * 0.5)},${n(y + h)}L${n(x0 + h * 0.5)},${n(y + d + h)}Z`;
  const foldR = `M${n(x1)},${n(y + h)}L${n(x1 - h * 0.5)},${n(y + h)}L${n(x1 - h * 0.5)},${n(y + d + h)}Z`;
  return (
    el('path', { d: left, fill: RIBBON_SHADE, ...stroke }) +
    el('path', { d: right, fill: RIBBON_SHADE, ...stroke }) +
    el('path', { d: foldL, fill: RIBBON_FOLD, ...stroke }) +
    el('path', { d: foldR, fill: RIBBON_FOLD, ...stroke }) +
    el('rect', { x: x0, y, width: w, height: h, fill: RIBBON, ...stroke }) +
    el('rect', { x: x0 + u * 0.45, y: y + u * 0.45, width: w - u * 0.9, height: h - u * 0.9, fill: 'none', stroke: palette.accent, 'stroke-width': u * 0.05 })
  );
}

/** A rule with a lozenge in the middle, under the title. */
function divider(cx: number, y: number, u: number): string {
  const s = { stroke: palette.accent, 'stroke-width': u * 0.09, 'stroke-linecap': 'round' as const };
  return (
    el('path', { d: `M${n(cx - u * 9)},${n(y)}H${n(cx - u * 1.6)}M${n(cx + u * 1.6)},${n(y)}H${n(cx + u * 9)}`, ...s }) +
    el('path', { d: `M${n(cx)},${n(y - u * 0.7)}L${n(cx + u * 0.7)},${n(y)}L${n(cx)},${n(y + u * 0.7)}L${n(cx - u * 0.7)},${n(y)}Z`, fill: palette.accent }) +
    el('circle', { cx: cx - u * 1.15, cy: y, r: u * 0.18, fill: palette.accent }) +
    el('circle', { cx: cx + u * 1.15, cy: y, r: u * 0.18, fill: palette.accent }) +
    el('circle', { cx: cx - u * 9.6, cy: y, r: u * 0.22, fill: palette.accent }) +
    el('circle', { cx: cx + u * 9.6, cy: y, r: u * 0.22, fill: palette.accent })
  );
}

/** A corner flourish in a 50×50 box, drawn for the top-left corner. */
function cornerOrnament(): string {
  const s = { fill: 'none', stroke: palette.accent, 'stroke-linecap': 'round' as const };
  return (
    el('path', { d: 'M2,2L10,2L10,10L2,10Z', fill: palette.accent }) +
    el('path', { d: 'M13,4C24,4 28,9 34,7C40,5 41,0 46,3', ...s, 'stroke-width': 1.3 }) +
    el('path', { d: 'M4,13C4,24 9,28 7,34C5,40 0,41 3,46', ...s, 'stroke-width': 1.3 }) +
    el('path', { d: 'M14,14C20,14 22,20 28,18C32,17 32,12 28,12C25,12 25,16 28,16', ...s, 'stroke-width': 0.9 }) +
    el('path', { d: 'M14,14C14,20 20,22 18,28C17,32 12,32 12,28C12,25 16,25 16,28', ...s, 'stroke-width': 0.9 }) +
    el('circle', { cx: 47.5, cy: 3.6, r: 1.6, fill: palette.accent }) +
    el('circle', { cx: 3.6, cy: 47.5, r: 1.6, fill: palette.accent })
  );
}

function edgeOrnament(cx: number, y: number, u: number): string {
  const s = u * 0.9;
  return `<g transform="translate(${n(cx)},${n(y)})">${el('path', { d: `M0,${n(-s)}L${n(s)},0L0,${n(s)}L${n(-s)},0Z`, fill: palette.paper, stroke: palette.accent, 'stroke-width': u * 0.1 })}${el('circle', { r: s * 0.32, fill: palette.accent })}</g>`;
}
