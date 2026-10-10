/**
 * Botanical: the family as a plant on a herbarium sheet. A pale tree stands
 * behind the couple with its crown among their ancestors, the families are
 * joined by leafy stems, and the title is on a specimen label in the corner.
 */
import { LayoutCard, LayoutUnion, Pt } from '../../layout/layout-types';
import { yearSpan } from '../../lang/language';
import { centerline, leaves, sprig, taperedPath } from '../branches';
import { CardLook, FontSpec, PageBlock, PosterContext, PosterTheme, Rect } from '../poster-types';
import { unionMark } from '../../layout/union-marks';
import { el, fontAttrs, hash, n, seededRandom, text } from '../svg';
import { SANS, SERIF, SMALL_CAPS } from './fonts';

const LEAVES = ['#5d8a4c', '#7aa25a', '#3f6b45', '#93b26c'] as const;
const VEIN = '#2f4f2c';
const BARK = '#6b4e33';
const ROOT = '#86664a';

const palette = {
  paper: '#edf0e4',
  ink: '#1f2a21',
  muted: '#4b5a4a',
  faint: '#76836e',
  line: BARK,
  accent: '#8d3a47',
  card: '#fbfcf6',
  cardEdge: '#a8b598',
  kin: '#4d6b39',
  cardMale: '#e8eff6',
  cardFemale: '#f7e8ea',
  male: '#3c6c99',
  female: '#a5435d',
  break: '#8a2f2b',
};

export const botanical: PosterTheme = {
  id: 'botanical',
  name: 'Botanical',
  description: 'A herbarium sheet: a leafy tree with the couple at its trunk.',
  flow: 'down',
  palette,
  swatch: [palette.paper, LEAVES[0], palette.accent],
  tinctures: {
    azure: { fill: '#3c6c99', ink: '#f6f8f1' },
    gules: { fill: '#a5433d', ink: '#f6f8f1' },
    vert: { fill: '#4b7a3d', ink: '#f6f8f1' },
    purpure: { fill: '#795993', ink: '#f6f8f1' },
    or: { fill: '#c49631', ink: '#1f2a21' },
    tenne: { fill: '#bb6c31', ink: '#f6f8f1' },
    sanguine: { fill: '#923e5a', ink: '#f6f8f1' },
    celeste: { fill: '#5a90b0', ink: '#f6f8f1' },
    sable: { fill: '#3e453c', ink: '#f6f8f1' },
    argent: { fill: '#f1f4ea', ink: '#4b5a4a', edge: '#a8b598' },
  },
  card: {
    width: 196,
    radius: 14,
    textX: 49,
    padRight: 12,
    top: 10,
    bottom: 11,
    badge: { kind: 'seal', x: 12, size: 27, font: { family: SANS, size: 10, weight: 700, letterSpacing: 0.02 } },
    photoRadius: 15,
    kin: { family: SERIF, size: 11, weight: 500, style: 'italic', step: 0 },
    given: { family: SERIF, size: 15.5, weight: 600, step: 17 },
    surname: { family: SMALL_CAPS, size: 13, weight: 500, letterSpacing: 0.02, step: 16 },
    birth: { family: SMALL_CAPS, size: 11, weight: 500, letterSpacing: 0.02, step: 14 },
    dates: { family: SANS, size: 11.5, weight: 400, step: 15.5 },
    place: { family: SANS, size: 11, weight: 400, step: 14 },
  },
  spacing: { partnerGap: 50, siblingGap: 26, familyGap: 56, rowGap: 104 },
  line: { style: 'branch', width: 1.2, radius: 10 },
  tree: { wood: '#a8977a', bark: '#87765a', canopy: ['#c5d8b3', '#d4e3c5', '#e2ebd6'], leaves: ['#759d5b', '#8cb170', '#a3c388', '#b9d3a0'], opacity: 1 },
  unionFont: { family: SERIF, size: 11.5, style: 'italic' },
  generationFont: { family: SERIF, size: 17, weight: 500, style: 'italic' },
  margin: 0.05,
  fonts: [
    "600 16px 'Alegreya Variable'",
    "italic 400 16px 'Alegreya Variable'",
    "italic 500 16px 'Alegreya Variable'",
    "500 16px 'Alegreya SC'",
    "400 16px 'Alegreya Sans'",
    "700 16px 'Alegreya Sans'",
  ],

  background(c) {
    const { w, h, u, margin } = c.page;
    c.def('pp-bt-fibres', fibres('pp-bt-fibres', 220, 7));
    c.def(
      'pp-bt-wash',
      '<radialGradient id="pp-bt-wash" cx="50%" cy="55%" r="75%"><stop offset="55%" stop-color="#c9d1b6" stop-opacity="0"/><stop offset="100%" stop-color="#b5c09c" stop-opacity="0.32"/></radialGradient>',
    );
    const inset = margin * 0.45;
    return (
      el('rect', { width: w, height: h, fill: palette.paper }) +
      el('rect', { width: w, height: h, fill: 'url(#pp-bt-fibres)' }) +
      el('rect', { width: w, height: h, fill: 'url(#pp-bt-wash)' }) +
      el('rect', {
        x: inset,
        y: inset,
        width: w - inset * 2,
        height: h - inset * 2,
        fill: 'none',
        stroke: palette.faint,
        'stroke-width': u * 0.06,
        opacity: 0.55,
      })
    );
  },

  header(c): PageBlock {
    const u = c.page.u;
    const titleFont: FontSpec = { family: SERIF, size: u * 4.2, weight: 500, style: 'italic' };
    const subFont: FontSpec = { family: SMALL_CAPS, size: u * 1.35, weight: 500, letterSpacing: 0.12 };
    const height = titleFont.size * 1.15 + (c.subtitle ? u * 1.2 + subFont.size : 0) + u * 2.6;
    return {
      height,
      draw(r: Rect) {
        const cx = r.x + r.w / 2;
        const maxText = r.w * 0.66;
        const tw = c.measure(c.title, titleFont);
        const font = tw > maxText ? { ...titleFont, size: (titleFont.size * maxText) / tw } : titleFont;
        const width = Math.min(tw, maxText);
        const ty = r.y + font.size * 0.92;
        let out = el('text', { x: cx, y: ty, 'text-anchor': 'middle', ...fontAttrs(font), fill: palette.ink }, text(c.title));
        const sy = ty - font.size * 0.3;
        const gap = u * 1.6;
        out += sprig({ x: cx - width / 2 - gap, y: sy }, Math.PI + 0.12, u * 6.5, LEAVES, BARK, VEIN, 1);
        out += sprig({ x: cx + width / 2 + gap, y: sy }, -0.12, u * 6.5, LEAVES, BARK, VEIN, 2);
        if (c.subtitle) {
          out += el(
            'text',
            { x: cx, y: ty + u * 1.2 + subFont.size * 1.1, 'text-anchor': 'middle', ...fontAttrs(subFont), fill: palette.muted },
            text(c.subtitle),
          );
        }
        return out;
      },
    };
  },

  footer(c): PageBlock {
    const u = c.page.u;
    const capFont: FontSpec = { family: SMALL_CAPS, size: u * 1.05, weight: 500, letterSpacing: 0.14 };
    const nameFont: FontSpec = { family: SERIF, size: u * 1.9, weight: 600 };
    const lineFont: FontSpec = { family: SANS, size: u * 1.15 };
    const noteFont: FontSpec = { family: SERIF, size: u * 1.1, style: 'italic' };
    const legend = c.legend.filter((l) => l.key !== '').slice(0, 6);
    const lines = 1 + (legend.length ? 1 : 0);
    const labelH = u * 2.4 + nameFont.size * 1.25 + lines * lineFont.size * 1.55 + noteFont.size * 1.4 + u * 1.2;
    return {
      height: labelH + u * 1.5,
      draw(r: Rect) {
        const w = Math.min(r.w * 0.42, u * 46);
        const x = r.x + r.w - w;
        const y = r.y + r.h - labelH;
        let out = el('rect', { x, y, width: w, height: labelH, fill: palette.card, stroke: palette.ink, 'stroke-width': u * 0.07 });
        out += el('path', { d: `M${n(x)},${n(y + u * 2.2)}H${n(x + w)}`, stroke: palette.ink, 'stroke-width': u * 0.05 });
        const px = x + u * 1.3;
        out += el('text', { x: px, y: y + u * 1.5, ...fontAttrs(capFont), fill: palette.faint }, text(c.language.familyTree));
        let ly = y + u * 2.2 + nameFont.size * 1.05;
        out += el('text', { x: px, y: ly, ...fontAttrs(nameFont), fill: palette.ink }, text(c.fit(c.title, nameFont, w - u * 2.6)));
        if (c.subtitle) {
          ly += lineFont.size * 1.55;
          out += el('text', { x: px, y: ly, ...fontAttrs(lineFont), fill: palette.muted }, text(c.fit(c.subtitle, lineFont, w - u * 2.6)));
        }
        if (legend.length) {
          ly += lineFont.size * 1.55;
          let lx = px;
          for (const l of legend) {
            const t = c.theme.tinctures[l.tincture];
            const lw = c.measure(l.label, lineFont);
            if (lx + u * 1.4 + lw > x + w - u * 1.3) break;
            out += el('circle', {
              cx: lx + u * 0.45,
              cy: ly - lineFont.size * 0.32,
              r: u * 0.45,
              fill: t.fill,
              stroke: t.edge,
              'stroke-width': t.edge ? u * 0.05 : undefined,
            });
            out += el('text', { x: lx + u * 1.2, y: ly, ...fontAttrs(lineFont), fill: palette.muted }, text(l.label));
            lx += u * 1.2 + lw + u * 1.3;
          }
        }
        ly += noteFont.size * 1.5;
        const note = [c.language.drawn(c.now), c.years ? yearSpan(c.years.from, c.years.to) : ''].filter(Boolean).join(', ');
        out += el('text', { x: px, y: ly, ...fontAttrs(noteFont), fill: palette.faint }, text(note));
        return out;
      },
    };
  },

  cardShape(c, card: LayoutCard, look: CardLook) {
    const focus = look.focus;
    const b = botanical.card.badge;
    const r = b.size / 2;
    // A small leaf behind the seal, as if it grew from it.
    const leafAt: Pt = { x: b.x + r + r * 0.55, y: card.h / 2 - r * 0.55 };
    const leaf = `<g transform="translate(${n(leafAt.x)},${n(leafAt.y)}) rotate(-38)"><path d="M0,0Q5,-4 11,0Q5,4 0,0Z" fill="${LEAVES[hash(card.personId) % LEAVES.length]}"/></g>`;
    return (
      el('rect', {
        x: 0,
        y: 0,
        width: card.w,
        height: card.h,
        rx: botanical.card.radius,
        fill: look.fill,
        stroke: focus ? palette.kin : palette.cardEdge,
        'stroke-width': focus ? 1.6 : 0.9,
      }) + leaf
    );
  },

  connectors(c) {
    const { layout } = c;
    const H = c.options.cardHeight;
    const avoid: Rect[] = layout.cards.map((card) => ({ x: card.x, y: card.y, w: card.w, h: card.h }));
    if (c.settings.showUnions) {
      for (const u of layout.unions) avoid.push({ x: u.cx - 70, y: u.cy + H / 2 + 2, w: 140, h: 18 });
    }
    const roots: string[] = [];
    const branches: string[] = [];
    const foliage: string[] = [];
    for (const conn of layout.connectors) {
      const random = seededRandom(hash(conn.familyId));
      for (const drop of conn.drops) {
        const pts: Pt[] = [conn.stem, ...drop.points];
        const line = centerline(pts);
        // The line of ancestors is bare wood; the big tree behind already carries it.
        const direct = c.rootIds.has(drop.childId);
        if (direct) {
          roots.push(el('path', { d: taperedPath(line, 3, 1.6), fill: ROOT }));
        } else {
          branches.push(el('path', { d: taperedPath(line, 4.4, 1.4), fill: BARK, opacity: drop.relation === 'biological' ? 1 : 0.75 }));
          foliage.push(leaves(line, random, { spacing: 23, size: 11, colors: LEAVES, vein: VEIN, avoid, start: 12, end: 16 }));
        }
      }
    }
    return roots.join('') + branches.join('') + foliage.join('');
  },

  unionMarker(c: PosterContext, u: LayoutUnion, x: number, y: number) {
    const status = c.status(u.familyId);
    const r = 4.4;
    const berry = (cx: number, cy: number) => el('circle', { cx, cy, r, fill: palette.accent, stroke: '#5e2430', 'stroke-width': 0.6 });
    const mark = unionMark(u.kind, status, r);
    let inner: string;
    if (mark.apart) {
      // The berries have fallen apart and faded; a divorce cuts the stalk between them.
      const faded = (cx: number, cy: number) => el('circle', { cx, cy, r: r * 0.9, fill: '#c9a5aa', stroke: '#8f6b70', 'stroke-width': 0.6 });
      inner = mark.rings.length === 2 ? faded(-r * 1.25, 0.6) + faded(r * 1.25, -0.6) : faded(0, 0);
      if (mark.slash) {
        inner += el('path', { d: mark.slash, fill: 'none', stroke: palette.paper, 'stroke-width': 4.2, 'stroke-linecap': 'round' });
        inner += el('path', { d: mark.slash, fill: 'none', stroke: palette.break, 'stroke-width': 1.9, 'stroke-linecap': 'round' });
      }
    } else if (u.kind === 'marriage') {
      inner =
        `<g transform="rotate(-28)"><path d="M0,-2Q6,-9 13,-3Q6,1 0,-2Z" fill="${LEAVES[1]}"/></g>` +
        `<g transform="rotate(208)"><path d="M0,-2Q6,-9 13,-3Q6,1 0,-2Z" fill="${LEAVES[0]}"/></g>` +
        berry(-r * 0.75, 0.5) +
        berry(r * 0.75, -0.5);
    } else if (status === 'engaged' || u.kind === 'partnership') {
      inner = `<g transform="rotate(-28)"><path d="M0,-2Q6,-9 13,-3Q6,1 0,-2Z" fill="${LEAVES[1]}"/></g>` + berry(0, 0);
    } else {
      inner = el('circle', { r: 3, fill: BARK });
    }
    return `<g transform="translate(${n(x)},${n(y)})">${inner}</g>`;
  },

  focus(c, r) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    c.def(
      'pp-bt-halo',
      '<radialGradient id="pp-bt-halo"><stop offset="0%" stop-color="#cfdcb4" stop-opacity="0.9"/><stop offset="70%" stop-color="#d7e2c0" stop-opacity="0.45"/><stop offset="100%" stop-color="#e3ead3" stop-opacity="0"/></radialGradient>',
    );
    return el('ellipse', { cx, cy, rx: r.w / 2 + 46, ry: r.h / 2 + 40, fill: 'url(#pp-bt-halo)' });
  },

  generationLabel(c, label, x, y) {
    return el(
      'text',
      { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(botanical.generationFont), fill: palette.faint },
      text(label),
    );
  },
};

/** Paper fibres: short pale strokes in random directions. */
function fibres(id: string, size: number, seed: number): string {
  const rnd = seededRandom(seed);
  let out = '';
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI;
    const l = 1.5 + rnd() * 3.5;
    const bend = (rnd() - 0.5) * l * 0.8;
    const ex = Math.cos(a) * l;
    const ey = Math.sin(a) * l;
    out += `<path d="M${n(x)},${n(y)}q${n(ex / 2 - Math.sin(a) * bend)},${n(ey / 2 + Math.cos(a) * bend)} ${n(ex)},${n(ey)}" fill="none" stroke="${rnd() < 0.5 ? '#9aa58a' : '#b9c2a6'}" stroke-opacity="${n(0.14 + rnd() * 0.18)}" stroke-width="${n(0.25 + rnd() * 0.3)}"/>`;
  }
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${out}</pattern>`;
}
