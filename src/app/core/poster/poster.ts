/**
 * Draws a printable page of the tree: the part of the tree chosen in the print
 * settings, centred on a couple, in a print style, on a sheet of paper.
 * The result is a standalone SVG string; exporting turns it into PNG or PDF.
 */
import { LegendEntry, Tincture, assignColors } from '../colors/tinctures';
import { Kin, kinship } from '../kinship/kinship';
import { ChartLanguage, chartLanguage, kinLabel, surnameLinesIn } from '../lang/language';
import { computeLayout } from '../layout/layout';
import { COMFORTABLE_LAYOUT, LayoutCard, LayoutOptions, LayoutResult, LayoutUnion, Pt } from '../layout/layout-types';
import { bornTogether, connectorPaths, linkPath, unionLinePath, unionMarkerPoint } from '../layout/paths';
import { pictureBox } from '../layout/picture';
import { unionMark } from '../layout/union-marks';
import { dateYear } from '../model/dates';
import { initials } from '../model/names';
import { RelationshipStatus, isBrokenUp, relationshipStatus } from '../model/relationship';
import { birthGroupOf } from '../model/births';
import { birthSurname } from '../model/surnames';
import { sexSymbolPath } from '../layout/symbols';
import { TreeRoom, treeShape } from '../layout/tree-shape';
import { TreeIndex } from '../model/tree-index';
import { BackgroundImage, ColorBy, DEFAULT_PRINT, PrintSettings, Sex, TreeDocument, effectivePrint } from '../model/types';
import { drawMark } from './marks';
import { PX_PER_MM, paperSize } from './paper';
import { CardLine, CardLines, CardLook, CardText, FontSpec, PageBlock, PosterContext, PosterTheme, Rect } from './poster-types';
import { scopeDocument } from './scope';
import { cssFont, el, fontAttrs, mixHex, n, shieldPath, text } from './svg';
import { posterTheme } from './themes';

export interface PosterInput {
  doc: TreeDocument;
  /** Defaults to the document's print settings. */
  settings?: PrintSettings;
  /** Width of a text in a CSS font (canvas measureText in the browser). */
  measure(text: string, font: string): number;
  now?: Date;
}

export interface PosterResult {
  svg: string;
  /** Page size in CSS pixels (96 per inch). */
  width: number;
  height: number;
  /** Physical size, unless the page is sized to the tree. */
  paper?: { widthMm: number; heightMm: number; landscape: boolean };
  /** The size names print at, in points. */
  namePt: number;
  /** People on the page, and in the whole tree. */
  people: number;
  total: number;
  generations: number;
  centerId?: string;
  partnerId?: string;
  theme: PosterTheme;
  /** All text on the page, for embedding font subsets. */
  text: string;
}

/** A tree is not blown up beyond this on big paper; it would look like a children's book. */
const MAX_SCALE = 1.6;
const GUTTER = 64;
const UNION_LABEL_GAP = 15;
/** Room the sex symbol takes from the first line of a card. */
const SYMBOL_ROOM = 14;
/** A card grows at most to this many times its width to fit a relationship name; beyond, the name is shortened. */
const MAX_CARD_STRETCH = 2;
const DASH: Record<string, string> = { adopted: '5 4', foster: '1.2 3.6', step: '9 4', unknown: '2 4' };

export function renderPoster(input: PosterInput): PosterResult {
  const settings: PrintSettings = { ...DEFAULT_PRINT, ...(input.settings ?? effectivePrint(input.doc)) };
  const theme = posterTheme(settings.theme);
  const language = chartLanguage(input.doc.view.language);
  const now = input.now ?? new Date();
  const fullIndex = new TreeIndex(input.doc);
  const centerId = pickCenter(input.doc, fullIndex, settings);
  const partnerId = centerId ? pickPartner(fullIndex, centerId, settings) : undefined;

  const doc = centerId
    ? scopeDocument(input.doc, fullIndex, {
        centerId,
        partnerId,
        ancestors: settings.ancestors,
        descendants: settings.descendants,
        branches: settings.branches,
      }).doc
    : { ...input.doc, people: [], families: [] };
  const index = new TreeIndex(doc);
  // Surnames at birth come from the whole tree: a father may be outside the part that is printed.
  const births = new Map(doc.people.map((p) => [p.id, birthSurname(fullIndex, p, language.surnameFor)]));
  const surnames = new Map(doc.people.map((p) => [p.id, surnameLinesIn(language, p, births.get(p.id))]));

  const measure = (t: string, f: FontSpec) => input.measure(t, cssFont(f)) + (f.letterSpacing ?? 0) * f.size * Math.max(0, Array.from(t).length - 1);
  const fit = (t: string, f: FontSpec, max: number) => fitText(t, f, max, measure);

  // Relationship names, as seen from the person in the middle; their twins are named as such.
  const kin: ReadonlyMap<string, Kin> = centerId ? kinship(fullIndex, centerId) : new Map();
  const twins = centerId ? birthGroupOf(input.doc, centerId) : undefined;
  const bornWith = new Map(twins ? twins.memberIds.filter((m) => m !== centerId).map((m) => [m, twins.memberIds.length]) : []);
  const relations = new Map(doc.people.map((p) => [p.id, settings.showRelationships ? kinLabel(language, kin.get(p.id), p.sex, bornWith.get(p.id)) : '']));

  // Cards: every card has the same lines, so rows line up.
  const card = theme.card;
  // The sex symbol sits in the top right corner; the first line stops short of it.
  const symbolRoom = settings.showSex ? SYMBOL_ROOM : 0;
  // A relationship name that does not fit makes its card wider.
  const widths = new Map<string, number>();
  for (const [id, relation] of relations) {
    const needed = Math.ceil(card.textX + measure(relation, card.kin) + symbolRoom + card.padRight);
    if (relation && needed > card.width) widths.set(id, Math.min(needed, card.width * MAX_CARD_STRETCH));
  }
  const lines = presentLines(
    theme,
    settings,
    [...surnames.values()].some((s) => !!s.birth),
  );
  const cardHeight = cardHeightFor(theme, lines);
  let options: LayoutOptions = { ...COMFORTABLE_LAYOUT, ...theme.spacing, cardWidth: card.width, cardHeight };
  const layoutWith = (o: LayoutOptions) => {
    const l = computeLayout(doc, o, undefined, widths);
    return theme.flow === 'up' ? flipLayout(l) : l;
  };
  let layout = layoutWith(options);

  const texts = new Map<string, CardText>();
  for (const p of doc.people) {
    const textWidth = (widths.get(p.id) ?? card.width) - card.textX - card.padRight;
    const place = p.birth?.place ?? p.death?.place ?? '';
    const names = surnames.get(p.id) ?? { surname: p.name.surname.trim(), birth: '' };
    const relation = relations.get(p.id) ?? '';
    texts.set(p.id, {
      kin: relation ? fit(relation, card.kin, textWidth - symbolRoom) : '',
      given: fit(p.name.given.trim() || language.unnamed, card.given, textWidth - (settings.showRelationships ? 0 : symbolRoom)),
      surname: fit(names.surname, card.surname, textWidth),
      birth: fit(names.birth, card.birth, textWidth),
      dates: settings.showDates ? fit(language.lifespan(p), card.dates, textWidth) : '',
      place: settings.showPlaces ? fit(place, card.place, textWidth) : '',
      initials: initials(p),
    });
  }

  const colors = assignColors(doc, input.doc.view.colorBy, layout.ranks, (p) => births.get(p.id) || p.name.surname.trim());
  const focusIds = [centerId, partnerId].filter((id): id is string => !!id && !!index.person(id));
  const rootIds = new Set<string>(focusIds);
  for (const id of focusIds) for (const a of index.ancestors(id)) rootIds.add(a);

  const generations = layout.rows.length;
  const title = settings.title?.trim() || input.doc.meta.title || 'Family tree';
  const subtitle = settings.subtitle?.trim() ?? (doc.people.length ? language.summary(generations, doc.people.length) : '');

  const defs = new Map<string, string>();
  const ctx: PosterContext = {
    theme,
    settings,
    language,
    doc,
    index,
    layout,
    options,
    page: { w: 0, h: 0, u: 0, margin: 0 },
    chart: { x: 0, y: 0, w: 0, h: 0 },
    scale: 1,
    colors: colors.byPerson,
    legend: colors.legend.map((l) => ({ ...l, label: legendLabel(l, input.doc.view.colorBy, language) })),
    kin,
    texts,
    lines,
    focusIds,
    rootIds,
    title,
    subtitle: settings.subtitle?.trim() === '' ? '' : subtitle,
    years: yearRange(doc),
    now,
    measure,
    fit,
    def: (id, markup) => {
      if (!defs.has(id)) defs.set(id, markup);
    },
    person: (id) => index.person(id),
    status: (familyId) => {
      const f = index.family(familyId);
      return f ? relationshipStatus(f) : 'unknown';
    },
  };

  const paper = paperSize(settings.paper);
  const gutter = settings.showGenerations && layout.rows.length ? GUTTER : 0;
  const unionPad = settings.showUnions ? UNION_LABEL_GAP + 10 : 0;
  // Room above the oldest generation for the crown of the drawn tree (a picture of one's own fills the chart area as it is).
  const picture = settings.showTree ? input.doc.background : undefined;
  const crownPad = settings.showTree && !picture ? cardHeight * 0.8 : 0;

  /** Fits a layout on the page: the content box, the orientation and the scale. */
  const place = (l: LayoutResult) => {
    const b = l.bounds;
    // With the couple in the middle, the content is widened to be symmetric around them.
    const left = b.x - gutter;
    const right = b.x + b.w;
    const focusX = focusCenter(l, index, focusIds);
    const cx = settings.centered && focusX !== undefined ? focusX : (left + right) / 2;
    const half = Math.max(cx - left, right - cx, 1);
    const content: Rect = { x: cx - half, y: b.y - crownPad, w: half * 2, h: Math.max(b.h + unionPad + crownPad, 1) };
    if (!paper) {
      const u = clamp(Math.max(content.w, content.h) / 110, 8, 22);
      const margin = theme.margin * 100 * u;
      ctx.page = { w: content.w + margin * 2, h: 0, u, margin };
      const header = theme.header(ctx);
      const footer = theme.footer(ctx);
      ctx.page.h = content.h + margin * 2 + header.height + footer.height;
      const page = { ...ctx.page };
      return { cx, content, header, footer, landscape: false, page, chart: { x: margin, y: margin + header.height, w: content.w, h: content.h }, scale: 1 };
    }
    const portrait = { w: paper.widthMm * PX_PER_MM, h: paper.heightMm * PX_PER_MM };
    const candidates = settings.orientation === 'portrait' ? [false] : settings.orientation === 'landscape' ? [true] : [false, true];
    let best:
      | { cx: number; content: Rect; landscape: boolean; scale: number; header: PageBlock; footer: PageBlock; page: PosterContext['page']; chart: Rect }
      | undefined;
    for (const land of candidates) {
      const w = land ? portrait.h : portrait.w;
      const h = land ? portrait.w : portrait.h;
      const margin = theme.margin * Math.min(w, h);
      ctx.page = { w, h, u: Math.min(w, h) / 100, margin };
      const header = theme.header(ctx);
      const footer = theme.footer(ctx);
      const chart = { x: margin, y: margin + header.height, w: w - margin * 2, h: Math.max(10, h - margin * 2 - header.height - footer.height) };
      const scale = Math.min(chart.w / content.w, chart.h / content.h, MAX_SCALE);
      if (!best || scale > best.scale * 1.02) best = { cx, content, landscape: land, scale, header, footer, page: { ...ctx.page }, chart };
    }
    return best!;
  };

  let placed = place(layout);
  // When the width decides the size (a wide tree, or one side of the family
  // much bigger than the other), spread the generations out to fill the page.
  const gaps = new Set(layout.ranks.values()).size - 1;
  if (paper && gaps > 0 && placed.scale < MAX_SCALE) {
    const room = (placed.chart.h * 0.9) / placed.scale - placed.content.h;
    const extra = Math.min(room / gaps, options.rowGap * 1.5);
    if (extra > 12) {
      options = { ...options, rowGap: options.rowGap + extra };
      layout = layoutWith(options);
      placed = place(layout);
    }
  }
  ctx.layout = layout;
  ctx.options = options;
  ctx.page = placed.page;
  ctx.chart = placed.chart;
  ctx.scale = placed.scale;
  const { header, footer, landscape, content, cx } = placed;

  const s = ctx.scale;
  const tx = ctx.chart.x + ctx.chart.w / 2 - cx * s;
  const ty = ctx.chart.y + (ctx.chart.h - content.h * s) / 2 - content.y * s;
  const margin = ctx.page.margin;
  // The space between header and footer, in the chart's own units: the tree may fill it.
  const room: TreeRoom = { x: (ctx.chart.x - tx) / s, y: (ctx.chart.y - ty) / s, w: ctx.chart.w / s, h: ctx.chart.h / s };

  const body = [
    theme.background(ctx),
    header.draw({ x: margin, y: margin, w: ctx.page.w - margin * 2, h: header.height }),
    `<g transform="translate(${n(tx)},${n(ty)}) scale(${n(s)})">${drawChart(ctx, gutter, room)}</g>`,
    footer.draw({ x: margin, y: ctx.page.h - margin - footer.height, w: ctx.page.w - margin * 2, h: footer.height }),
    theme.overlay?.(ctx) ?? '',
  ].join('');

  const W = ctx.page.w;
  const H = ctx.page.h;
  const sizeAttrs = paper ? `width="${n(W / PX_PER_MM)}mm" height="${n(H / PX_PER_MM)}mm"` : `width="${Math.ceil(W)}" height="${Math.ceil(H)}"`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ${sizeAttrs} viewBox="0 0 ${n(W)} ${n(H)}">` +
    (defs.size ? `<defs>${[...defs.values()].join('')}</defs>` : '') +
    body +
    `</svg>`;

  const allText = [
    title,
    ctx.subtitle,
    language.drawn(now),
    ...[...texts.values()].flatMap((t) => [t.kin, t.given, t.surname, t.birth, t.dates, t.place, t.initials]),
    ...ctx.legend.map((l) => l.label),
    'IVXLCDM0123456789–·,. ?',
  ].join('');

  return {
    svg,
    width: W,
    height: H,
    paper: paper ? { widthMm: W / PX_PER_MM, heightMm: H / PX_PER_MM, landscape } : undefined,
    namePt: card.given.size * s * 0.75,
    people: doc.people.length,
    total: input.doc.people.length,
    generations,
    centerId,
    partnerId,
    theme,
    text: allText,
  };
}

// ---------------------------------------------------------------------------
// the tree itself

function drawChart(ctx: PosterContext, gutter: number, room: TreeRoom): string {
  const { layout, theme, settings } = ctx;
  const parts: string[] = [];
  const pal = theme.palette;

  // The tree or picture behind everything, then the generation numbers over it.
  if (settings.showTree) parts.push(ctx.doc.background ? drawPicture(ctx, ctx.doc.background, room) : drawTree(ctx, room));

  if (settings.showGenerations && gutter) {
    const x = layout.bounds.x - gutter / 2;
    layout.rows.forEach((row, i) => {
      const y = row.y + row.h / 2;
      parts.push(theme.generationLabel ? theme.generationLabel(ctx, row.label, x, y, i) : defaultGenerationLabel(ctx, row.label, x, y));
    });
  }

  const focus = focusRect(ctx);
  if (focus)
    parts.push(
      theme.focus
        ? theme.focus(ctx, focus)
        : el('rect', { x: focus.x, y: focus.y, width: focus.w, height: focus.h, rx: 8, fill: 'none', stroke: pal.accent, 'stroke-width': 2 }),
    );

  parts.push(theme.connectors ? theme.connectors(ctx) : defaultConnectors(ctx));
  for (const l of layout.links) {
    parts.push(
      el('path', {
        d: linkPath(l),
        fill: 'none',
        stroke: pal.line,
        'stroke-width': theme.line.width,
        'stroke-dasharray': '3 4',
        'stroke-linecap': 'round',
        opacity: 0.85,
      }),
    );
  }

  const W = ctx.options.cardWidth;
  const H = ctx.options.cardHeight;
  for (const u of layout.unions) {
    const d = unionLinePath(u);
    if (d)
      parts.push(el('path', { d, fill: 'none', stroke: pal.line, 'stroke-width': theme.line.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    const at = unionMarkerPoint(u);
    if (!at) continue;
    const { x: mx, y: my } = at;
    parts.push(theme.unionMarker ? theme.unionMarker(ctx, u, mx, my) : defaultUnionMarker(ctx, u, mx, my));
  }

  if (settings.showUnions) {
    const max = W + ctx.options.partnerGap - 16;
    for (const u of layout.unions) {
      if (u.mode !== 'gap' && u.mode !== 'bridge') continue;
      const fam = ctx.index.family(u.familyId);
      if (!fam) continue;
      const label = ctx.fit(ctx.language.union(relationshipStatus(fam)), theme.unionFont, max);
      if (!label) continue;
      // Under the couple in the middle, clear of the frame around them.
      const isFocus = fam.partners.every((p) => ctx.focusIds.includes(p));
      parts.push(
        el(
          'text',
          {
            x: u.cx,
            y: u.cy + H / 2 + UNION_LABEL_GAP + (isFocus && focus ? 9 : 0),
            'text-anchor': 'middle',
            ...fontAttrs(theme.unionFont),
            fill: pal.muted,
            stroke: pal.paper,
            'stroke-width': 4.5,
            'stroke-linejoin': 'round',
            'paint-order': 'stroke',
          },
          text(label),
        ),
      );
    }
  }

  for (const p of layout.placeholders) {
    parts.push(
      `<g transform="translate(${n(p.cx)},${n(p.cy)})">` +
        el('circle', { r: p.r, fill: pal.card, stroke: pal.muted, 'stroke-width': 1.1, 'stroke-dasharray': '3 2.6' }) +
        el(
          'text',
          {
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            ...fontAttrs({ family: theme.card.given.family, size: 12, weight: 600 }),
            fill: pal.muted,
          },
          '?',
        ) +
        `</g>`,
    );
  }

  for (const c of layout.cards) parts.push(drawCard(ctx, c));
  return parts.join('');
}

function drawCard(ctx: PosterContext, c: LayoutCard): string {
  const { theme, settings } = ctx;
  const card = theme.card;
  const pal = theme.palette;
  const t = ctx.texts.get(c.personId);
  const person = ctx.person(c.personId);
  if (!t || !person) return '';
  const look: CardLook = {
    focus: ctx.focusIds.includes(c.personId),
    fill: settings.sexColors && person.sex === 'male' ? pal.cardMale : settings.sexColors && person.sex === 'female' ? pal.cardFemale : pal.card,
  };
  const tincture = theme.tinctures[ctx.colors.get(c.personId) ?? 'argent'];
  const parts: string[] = [theme.cardShape ? theme.cardShape(ctx, c, look) : defaultCardShape(ctx, c, look)];
  if (settings.showSex) {
    const d = sexSymbolPath(person.sex, 11);
    const color = person.sex === 'male' ? pal.male : person.sex === 'female' ? pal.female : pal.kin;
    if (d)
      parts.push(
        `<path transform="translate(${n(c.w - 12)},12)" d="${d}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
  }

  const photo = settings.showPhotos ? person.photo : undefined;
  const badge = card.badge;
  if (photo) {
    const r = card.photoRadius;
    const cx = badge.x + badge.size / 2;
    const cy = c.h / 2;
    const id = `pp-photo-${c.personId}`;
    ctx.def(id, `<clipPath id="${id}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/></clipPath>`);
    parts.push(el('circle', { cx, cy, r: r + 1.5, fill: tincture.fill, stroke: tincture.edge }));
    parts.push(
      el('image', { href: photo, x: cx - r, y: cy - r, width: r * 2, height: r * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${id})` }),
    );
  } else if (badge.kind === 'shield') {
    const w = badge.size;
    const h = badge.size * 1.18;
    parts.push(
      `<g transform="translate(${n(badge.x)},${n((c.h - h) / 2)})">` +
        el('path', { d: shieldPath(w, h), fill: tincture.fill, stroke: tincture.edge, 'stroke-width': tincture.edge ? 0.9 : undefined }) +
        el(
          'text',
          { x: w / 2, y: h * 0.47, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(badge.font), fill: tincture.ink },
          text(t.initials),
        ) +
        `</g>`,
    );
  } else if (badge.kind === 'seal') {
    const r = badge.size / 2;
    const cx = badge.x + r;
    const cy = c.h / 2;
    parts.push(el('circle', { cx, cy, r, fill: tincture.fill, stroke: tincture.edge, 'stroke-width': tincture.edge ? 0.9 : undefined }));
    parts.push(
      el(
        'text',
        { x: cx, y: cy + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(badge.font), fill: tincture.ink },
        text(t.initials),
      ),
    );
  } else if (badge.kind === 'bar') {
    parts.push(el('rect', { x: 0, y: 0, width: badge.size, height: c.h, fill: tincture.fill === theme.tinctures.argent.fill ? pal.cardEdge : tincture.fill }));
  }

  let y = card.top;
  let first = true;
  const line = (value: string, spec: CardLine, fill: string, present: boolean) => {
    if (!present) return;
    y += first ? spec.size * 0.74 : spec.step;
    first = false;
    if (value) parts.push(el('text', { x: card.textX, y, ...fontAttrs(spec), fill }, text(value)));
  };
  const lines = ctx.lines;
  line(t.kin, card.kin, pal.kin, lines.kin);
  line(t.given, card.given, pal.ink, true);
  line(t.surname, card.surname, pal.ink, true);
  line(t.birth, card.birth, pal.muted, lines.birth);
  line(t.dates, card.dates, pal.muted, lines.dates);
  line(t.place, card.place, pal.faint, lines.place);

  return `<g transform="translate(${n(c.x)},${n(c.y)})">${parts.join('')}</g>`;
}

function defaultCardShape(ctx: PosterContext, c: LayoutCard, look: CardLook): string {
  const pal = ctx.theme.palette;
  return el('rect', {
    x: 0,
    y: 0,
    width: c.w,
    height: c.h,
    rx: ctx.theme.card.radius,
    fill: look.fill,
    stroke: look.focus ? pal.ink : pal.cardEdge,
    'stroke-width': look.focus ? 1.5 : 0.9,
  });
}

/**
 * The person's own picture over the whole chart area, as it is: an SVG stays
 * a drawing in SVG files and is drawn at full resolution in PDF and PNG.
 */
function drawPicture(ctx: PosterContext, picture: BackgroundImage, room: TreeRoom): string {
  const clip = 'pp-picture-room';
  ctx.def(clip, `<clipPath id="${clip}"><rect x="${n(room.x)}" y="${n(room.y)}" width="${n(room.w)}" height="${n(room.h)}"/></clipPath>`);
  const box = pictureBox(room, picture);
  const image = el('image', {
    href: picture.href,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    opacity: picture.opacity < 1 ? picture.opacity : undefined,
  });
  return `<g clip-path="url(#${clip})">${image}</g>`;
}

/** The tree behind the chart, painted in the style's colours. */
function drawTree(ctx: PosterContext, room: TreeRoom): string {
  // The tree always grows upwards from the couple; a chart drawn the other way up gets a mirrored tree.
  const flipped = ctx.theme.flow === 'up';
  const L = ctx.layout;
  const axis = L.bounds.y * 2 + L.bounds.h;
  const treeRoom = flipped ? { ...room, y: axis - room.y - room.h } : room;
  const shape = treeShape(flipped ? flipLayout(L) : L, ctx.index, ctx.focusIds, { room: treeRoom });
  if (!shape) return '';
  const t = ctx.theme.tree;
  const f = shape.foliage;
  const fill = (color: string, parts: readonly string[]) => (parts.length ? `<path fill="${color}" d="${parts.join('')}"/>` : '');
  // Twigs inside the crown, the crown of leaves over them, the trunk and limbs over the crown,
  // and single leaves over everything. The crown is lighter at the top, where the sun is.
  const gradient = 'pp-tree-crown';
  ctx.def(
    gradient,
    `<linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${mixHex(t.canopy[1], t.canopy[2], 0.7)}"/><stop offset="0.6" stop-color="${t.canopy[1]}"/><stop offset="1" stop-color="${mixHex(t.canopy[1], t.canopy[0], 0.6)}"/>` +
      `</linearGradient>`,
  );
  let art = fill(t.wood, shape.twigs);
  art += fill(t.canopy[0], f.shade) + fill(`url(#${gradient})`, f.body) + fill(t.canopy[2], f.light);
  art += fill(t.wood, shape.wood);
  if (t.bark && shape.bark.length)
    art += `<path fill="none" stroke="${t.bark}" stroke-width="1.2" stroke-linecap="round" opacity="0.6" d="${shape.bark.join('')}"/>`;
  f.leaves.forEach((leaves, i) => (art += fill(t.leaves[i % t.leaves.length], leaves)));
  // Outlines of each colour all wind the same way, so where they overlap they fill instead of cancelling out.
  const clip = 'pp-tree-room';
  ctx.def(clip, `<clipPath id="${clip}"><rect x="${n(treeRoom.x)}" y="${n(treeRoom.y)}" width="${n(treeRoom.w)}" height="${n(treeRoom.h)}"/></clipPath>`);
  const tree = `<g clip-path="url(#${clip})" opacity="${n(t.opacity)}">${art}</g>`;
  return flipped ? `<g transform="translate(0,${n(axis)}) scale(1,-1)">${tree}</g>` : tree;
}

function defaultConnectors(ctx: PosterContext): string {
  const { theme, layout } = ctx;
  const style = theme.line.style === 'curved' ? 'curved' : 'square';
  const out: string[] = [];
  for (const c of layout.connectors) {
    for (const p of connectorPaths(c, style, theme.line.radius, bornTogether(ctx.index.family(c.familyId)))) {
      out.push(
        el('path', {
          d: p.d,
          fill: 'none',
          stroke: theme.palette.line,
          'stroke-width': theme.line.width,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-dasharray': DASH[p.relation],
        }),
      );
    }
  }
  return out.join('');
}

function defaultUnionMarker(ctx: PosterContext, u: LayoutUnion, x: number, y: number): string {
  const pal = ctx.theme.palette;
  return drawMark(unionMark(u.kind, ctx.status(u.familyId), 4.6), x, y, {
    plate: pal.card,
    plateEdge: pal.cardEdge,
    ring: pal.accent,
    ringApart: pal.muted,
    dot: pal.line,
    cut: pal.break,
  });
}

function defaultGenerationLabel(ctx: PosterContext, label: string, x: number, y: number): string {
  return el(
    'text',
    { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...fontAttrs(ctx.theme.generationFont), fill: ctx.theme.palette.faint },
    text(label),
  );
}

// ---------------------------------------------------------------------------
// helpers

/** Which optional lines the cards have. `birth`: someone on the page was born with another surname. */
export function presentLines(theme: PosterTheme, settings: PrintSettings, birth = false): CardLines {
  void theme;
  return { kin: settings.showRelationships, birth, dates: settings.showDates, place: settings.showPlaces };
}

export function cardHeightFor(theme: PosterTheme, lines: CardLines): number {
  const c = theme.card;
  const specs: CardLine[] = [];
  if (lines.kin) specs.push(c.kin);
  specs.push(c.given, c.surname);
  if (lines.birth) specs.push(c.birth);
  if (lines.dates) specs.push(c.dates);
  if (lines.place) specs.push(c.place);
  let y = c.top + specs[0].size * 0.74;
  for (const s of specs.slice(1)) y += s.step;
  return Math.round(y + c.bottom);
}

function fitText(t: string, f: FontSpec, max: number, measure: (t: string, f: FontSpec) => number): string {
  if (!t || measure(t, f) <= max) return t;
  const chars = Array.from(t);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join('').trimEnd() + '…', f) <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? chars.slice(0, lo).join('').trimEnd() + '…' : '…';
}

function pickCenter(doc: TreeDocument, index: TreeIndex, settings: PrintSettings): string | undefined {
  if (settings.centerId && index.person(settings.centerId)) return settings.centerId;
  if (doc.meta.homePersonId && index.person(doc.meta.homePersonId)) return doc.meta.homePersonId;
  return doc.people[0]?.id;
}

function pickPartner(index: TreeIndex, centerId: string, settings: PrintSettings): string | undefined {
  if (settings.partnerId === null) return undefined;
  const fams = index.partnerFamilies(centerId).filter((f) => f.partners.length === 2);
  if (settings.partnerId && fams.some((f) => f.partners.includes(settings.partnerId!))) return settings.partnerId;
  const current = [...fams].reverse().find((f) => !isBrokenUp(relationshipStatus(f))) ?? fams[fams.length - 1];
  return current?.partners.find((p) => p !== centerId);
}

/** Where the couple in the middle is: their union marker, or the person's card. */
function focusCenter(layout: LayoutResult, index: TreeIndex, focusIds: readonly string[]): number | undefined {
  if (!focusIds.length) return undefined;
  if (focusIds.length === 2) {
    const fam = index.familyBetween(focusIds[0], focusIds[1]);
    const u = fam ? layout.unions.find((x) => x.familyId === fam.id && (x.mode === 'gap' || x.mode === 'bridge')) : undefined;
    if (u) return u.cx;
  }
  const c = layout.cards.find((x) => x.personId === focusIds[0]);
  return c ? c.x + c.w / 2 : undefined;
}

function focusRect(ctx: PosterContext): Rect | undefined {
  const cards = ctx.layout.cards.filter((c) => ctx.focusIds.includes(c.personId));
  if (!cards.length) return undefined;
  const sameRow = cards.every((c) => c.y === cards[0].y);
  const use = sameRow ? cards : cards.filter((c) => c.personId === ctx.focusIds[0]);
  const pad = 7;
  const x0 = Math.min(...use.map((c) => c.x)) - pad;
  const x1 = Math.max(...use.map((c) => c.x + c.w)) + pad;
  const y0 = Math.min(...use.map((c) => c.y)) - pad;
  const y1 = Math.max(...use.map((c) => c.y + c.h)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A legend entry in the chart's language: family names as they are, other groups in words. */
function legendLabel(entry: LegendEntry, colorBy: ColorBy, language: ChartLanguage): string {
  if (entry.key === '') return language.others;
  if (colorBy === 'sex') return language.sexes[entry.key as Sex] ?? entry.label;
  if (colorBy === 'generation') return `${language.generation} ${entry.label}`;
  return entry.label;
}

function yearRange(doc: TreeDocument): { from: number; to: number } | undefined {
  let from = Infinity;
  let to = -Infinity;
  for (const p of doc.people) {
    for (const e of [p.birth, p.death]) {
      const y = dateYear(e?.date);
      if (y !== undefined) {
        from = Math.min(from, y);
        to = Math.max(to, y);
      }
    }
  }
  return Number.isFinite(from) ? { from, to } : undefined;
}

/** Turns the chart upside down (oldest at the bottom) without turning the cards. */
export function flipLayout(L: LayoutResult): LayoutResult {
  const top = L.bounds.y;
  const bottom = L.bounds.y + L.bounds.h;
  const fy = (y: number) => top + bottom - y;
  const fp = (p: Pt): Pt => ({ x: p.x, y: fy(p.y) });
  return {
    ...L,
    cards: L.cards.map((c) => ({ ...c, y: fy(c.y + c.h) })),
    placeholders: L.placeholders.map((p) => ({ ...p, cy: fy(p.cy) })),
    unions: L.unions.map((u) => ({ ...u, cy: fy(u.cy), line: u.line.map(fp) })),
    connectors: L.connectors.map((c) => ({
      ...c,
      stem: fp(c.stem),
      clearY: fy(c.clearY),
      barY: fy(c.barY),
      drops: c.drops.map((d) => ({ ...d, points: d.points.map(fp) })),
    })),
    links: L.links.map((l) => ({ ...l, from: fp(l.from), clearY: fy(l.clearY), to: fp(l.to) })),
    rows: L.rows.map((r) => ({ ...r, y: fy(r.y + r.h) })),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type { Tincture, RelationshipStatus };
