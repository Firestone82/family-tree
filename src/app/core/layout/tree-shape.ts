/**
 * A tree drawn behind the chart, the way an illustrator would draw a family
 * tree. Its trunk stands behind the couple the tree is centred on. Above them
 * a limb grows to each pair of parents and forks again for every generation,
 * thinning out as it goes, with leafy sprigs along the way; where a line of
 * ancestors ends, the limb opens into a rounded crown of leaves. Below the
 * couple the trunk spreads into roots that reach their children and
 * grandchildren.
 *
 * The shape follows the layout, so it always matches the family. Leaves and
 * twigs are placed with a seeded random generator: the same tree always comes
 * out the same.
 */
import { TreeIndex } from '../model/tree-index';
import { Foliage, canopy, clump, emptyFoliage, leavesAlong } from './foliage';
import { LayoutResult, Pt } from './layout-types';
import { cubic, lengths, offsetLine, outline, seeded, tangent } from './organic';

export interface TreeShape {
  /** Filled outlines: trunk, limbs and roots, drawn over the crown of leaves. */
  wood: string[];
  /** Twigs inside the crown, drawn under the leaves so they disappear into them. */
  twigs: string[];
  /** Lines along the thicker wood, like bark. */
  bark: string[];
  foliage: Foliage;
}

export interface TreeRoom {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreeShapeOptions {
  /** The area the tree may use; crowns and roots stay inside it. Defaults to the chart with some space around it. */
  room?: TreeRoom;
  /** How leafy the tree is, from 0 (bare wood) to 1. */
  leaves?: number;
}

/** A family the tree passes through on its way up. */
interface Node {
  id: string;
  /** Where the limb from below passes: the union marker, a lone parent's card or the placeholder. */
  at: Pt;
  /** Just above the parents: where the limb forks again. */
  fork: Pt;
  /** One per partner, left to right: the limb to their parents, or a crown where the line ends. */
  sides: Side[];
  weight: number;
}

interface Side {
  lean: number;
  parent: Node | null;
}

/** How much a crown weighs against a limb carrying one more family. */
const CROWN = 0.7;
/** Wood lost to side twigs at every fork, so limbs thin out even where they do not split. */
const LOSS = 0.3;
const UP = -Math.PI / 2;

export function treeShape(layout: LayoutResult, index: TreeIndex, focusIds: readonly string[], options: TreeShapeOptions = {}): TreeShape | null {
  const cardOf = new Map(layout.cards.map((c) => [c.personId, c]));
  const present = focusIds.filter((id) => cardOf.has(id));
  if (!present.length) return null;

  // The usual card size sets the scale; a card made wider for a long relationship name does not.
  const S = Math.min(...layout.cards.map((c) => c.w));
  const H = layout.cards[0].h;
  const b = layout.bounds;
  const room = options.room ?? { x: b.x - S, y: b.y - H * 1.6, w: b.w + S * 2, h: b.h + H * 3.2 };
  const leafiness = options.leaves ?? 1;
  const minW = Math.max(1.3, S * 0.01);
  const leafLen = Math.max(8, Math.min(19, S * 0.085));
  const unionOf = new Map(layout.unions.map((u) => [u.familyId, u]));
  const placeholderOf = new Map(layout.placeholders.map((p) => [p.familyId, p]));

  // Horizontal bands taken by cards and placeholders: how much free space is above or below a point.
  const bands = [
    ...[...layout.rows, ...layout.lanes].map((r) => ({ top: r.y, bottom: r.y + r.h })),
    ...layout.placeholders.map((p) => ({ top: p.cy - p.r, bottom: p.cy + p.r })),
  ];
  const spaceAbove = (y: number) => y - Math.max(room.y, ...bands.filter((x) => x.bottom <= y - 0.5).map((x) => x.bottom));
  const spaceBelow = (y: number) => Math.min(room.y + room.h, ...bands.filter((x) => x.top >= y + 0.5).map((x) => x.top)) - y;

  const wood: string[] = [];
  const twigs: string[] = [];
  const bark: string[] = [];
  const foliage = emptyFoliage();

  // --- the structure: which families the limbs pass through -----------------

  const seen = new Set<string>();
  const sidesFor = (partnerIds: readonly string[]): Side[] => {
    const cards = partnerIds
      .map((id) => cardOf.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.x - b.x);
    if (!cards.length) return [{ lean: 0, parent: null }];
    return cards.map((c, i) => ({ lean: cards.length === 1 ? 0 : i === 0 ? -1 : 1, parent: parentNode(c.personId) }));
  };
  const forkAbove = (x: number, top: number): Pt => ({ x, y: top - clamp(spaceAbove(top) * 0.3, 6, H * 0.45) });
  const nodeFor = (familyId: string): Node | null => {
    if (seen.has(familyId)) return null;
    const u = unionOf.get(familyId);
    const ph = placeholderOf.get(familyId);
    let at: Pt;
    let top: number;
    if (u && (u.mode === 'gap' || u.mode === 'bridge')) {
      at = { x: u.cx, y: u.cy };
      top = u.cy - H / 2;
    } else if (u && (u.mode === 'single' || u.mode === 'split')) {
      at = { x: u.cx, y: u.cy - H / 2 };
      top = u.cy - H;
    } else if (ph) {
      at = { x: ph.cx, y: ph.cy };
      top = ph.cy - ph.r;
    } else return null;
    seen.add(familyId);
    const sides = sidesFor(index.family(familyId)?.partners ?? []);
    return { id: familyId, at, fork: forkAbove(at.x, top), sides, weight: weightOf(sides) };
  };
  const parentNode = (personId: string): Node | null => {
    const f = index.primaryParentFamily(personId);
    return f ? nodeFor(f.id) : null;
  };
  const weightOf = (sides: Side[]) => 1 + sides.reduce((s, x) => s + (x.parent ? x.parent.weight : CROWN), 0);

  const couple = present.length === 2 ? index.familyBetween(present[0], present[1]) : undefined;
  let root = couple ? nodeFor(couple.id) : null;
  if (!root) {
    const c = cardOf.get(present[0])!;
    const sides = sidesFor([present[0]]);
    root = { id: present[0], at: { x: c.x + c.w / 2, y: c.y + c.h / 2 }, fork: forkAbove(c.x + c.w / 2, c.y), sides, weight: weightOf(sides) };
  }

  // --- drawing helpers --------------------------------------------------------

  const lerp = (a: number, z: number, t: number) => a + (z - a) * t;

  /**
   * A piece of wood along `line`: `w0` wide at the start, `w1` at the end. A
   * branch growing out of a thicker one starts as wide as its parent (`collar`)
   * and narrows quickly, so the fork is one smooth crotch instead of a joint.
   */
  const addWood = (line: Pt[], w0: number, w1: number, collar = w0, withBark = true, seed = 0, under = false) => {
    const width = (t: number) => {
      const base = w0 + (w1 - w0) * Math.pow(t, 0.85);
      if (collar <= w0 || t >= 0.22) return base;
      const k = t / 0.22;
      return collar + (base - collar) * k * k * (3 - 2 * k);
    };
    (under ? twigs : wood).push(outline(line, width, w0 > 6 ? 0.07 : 0.03, seed));
    if (!withBark || Math.min(w0, w1) < 8) return;
    bark.push(offsetLine(line, width, 0.46, 0.12, 0.78), offsetLine(line, width, -0.3, 0.25, 0.66));
    if (w1 > 18) bark.push(offsetLine(line, width, 0.08, 0.35, 0.9), offsetLine(line, width, -0.7, 0.06, 0.42));
  };

  /** Shortens a twig so it stays in the room; null when there is no room for it. */
  const fit = (from: Pt, angle: number, len: number): number | null => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let max = len;
    if (dx < -1e-6) max = Math.min(max, (room.x - from.x) / dx);
    if (dx > 1e-6) max = Math.min(max, (room.x + room.w - from.x) / dx);
    if (dy < -1e-6) max = Math.min(max, (room.y - from.y) / dy);
    if (dy > 1e-6) max = Math.min(max, (room.y + room.h - from.y) / dy);
    return max >= len * 0.35 ? max * 0.98 : null;
  };

  /** A gently curving twig; returns its centre line (or null when it does not fit). */
  const twigLine = (from: Pt, angle: number, len: number, rnd: () => number): Pt[] | null => {
    const l = fit(from, angle, len);
    if (l === null) return null;
    const bend = (rnd() - 0.5) * 0.7;
    const end = { x: from.x + Math.cos(angle + bend * 0.3) * l, y: from.y + Math.sin(angle + bend * 0.3) * l };
    const c1 = { x: from.x + Math.cos(angle - bend * 0.4) * l * 0.38, y: from.y + Math.sin(angle - bend * 0.4) * l * 0.38 };
    const c2 = { x: from.x + Math.cos(angle + bend * 0.5) * l * 0.74, y: from.y + Math.sin(angle + bend * 0.5) * l * 0.74 };
    return cubic(from, c1, c2, end, clamp(Math.round(l / 9), 5, 16));
  };

  /** A leafy sprig growing out of a limb. */
  const sprig = (from: Pt, angle: number, len: number, w: number, collar: number, rnd: () => number, mass: boolean) => {
    const line = twigLine(from, angle, len, rnd);
    if (!line) return;
    addWood(line, w, minW, collar, false);
    if (leafiness <= 0) return;
    leavesAlong(foliage, line, leafLen * 0.9, rnd, 0.3);
    if (mass) clump(foliage, line[line.length - 1], S * (0.07 + rnd() * 0.05), leafLen, rnd, { leaves: 7 });
  };

  /** Sprigs along a limb, alternating sides and growing outwards and up. */
  const sprigsAlong = (line: Pt[], width: (t: number) => number, rnd: () => number) => {
    if (leafiness <= 0) return;
    const s = lengths(line);
    const total = s[s.length - 1];
    const spacing = (S * 0.5) / leafiness;
    let side = rnd() < 0.5 ? 1 : -1;
    let i = 0;
    for (let at = spacing * (0.4 + rnd() * 0.3); at < total - spacing * 0.3; at += spacing * (0.7 + rnd() * 0.6)) {
      while (i + 1 < s.length && s[i + 1] < at) i++;
      const t = at / total;
      if (t < 0.12 || t > 0.9) continue;
      const tg = tangent(line, i);
      let a = Math.atan2(tg.y, tg.x) + side * (0.7 + rnd() * 0.4);
      a = towards(a, UP, 0.3);
      side = -side;
      if (Math.sin(a) > -0.15) continue;
      const lw = width(t);
      const w = Math.max(minW, Math.min(lw * 0.3, S * 0.035));
      sprig(line[i], a, S * (0.2 + rnd() * 0.16), w, Math.min(lw * 0.5, w * 2), rnd, rnd() < 0.55);
    }
  };

  /** Points the crown of leaves must cover: the families the limbs reach and the ends of the lines. */
  const crownPoints: Pt[] = [];
  const spread = S * 0.6;
  const keepIn = (p: Pt): Pt => ({
    x: clamp(p.x, room.x + spread * 0.9, room.x + room.w - spread * 0.9),
    y: clamp(p.y, room.y + spread * 0.95, room.y + room.h),
  });

  /** Where a line of ancestors ends, the limb opens into a few branches that spread into the leaves. */
  const crown = (from: Pt, w: number, lean: number, rnd: () => number) => {
    const R = clamp((spaceAbove(from.y) + H * 0.7) * 0.5, S * 0.3, S * 0.6);
    const angle = UP + lean * (0.5 + rnd() * 0.15) + (rnd() - 0.5) * 0.1;
    crownPoints.push(keepIn({ x: from.x + Math.cos(angle) * R * 0.7 + lean * R * 0.2, y: from.y + Math.sin(angle) * R * 0.7 }));
    const branches = lean ? 2 : 3;
    for (let i = 0; i < branches; i++) {
      const a = angle + (i - (branches - 1) / 2) * 0.62 + (rnd() - 0.5) * 0.2;
      const line = twigLine(from, a, R * (0.72 + rnd() * 0.3), rnd);
      if (!line) continue;
      const bw = Math.max(minW, w * (i === Math.floor(branches / 2) ? 0.75 : 0.55));
      addWood(line, bw, minW, w, false, 0, true);
      if (leafiness > 0) leavesAlong(foliage, line, leafLen, rnd, 0.35);
    }
  };

  /**
   * The way up from one fork to the next family's fork, just above their
   * cards: one smooth curve that leaves turned towards the family and arrives
   * heading upwards, so it passes behind the couple near their union.
   */
  const limbLine = (from: Pt, to: Node, leaveAngle: number): Pt[] => {
    const a = from;
    const z = to.fork;
    if (z.y >= a.y - 4) return cubic(a, a, z, z, 8);
    const d = Math.hypot(z.x - a.x, z.y - a.y);
    const toward = normalize({ x: z.x - a.x, y: z.y - a.y });
    const leave = normalize({ x: toward.x * 0.55 + Math.cos(leaveAngle) * 0.45, y: toward.y * 0.55 + Math.sin(leaveAngle) * 0.45 });
    const arrive = normalize({ x: toward.x * 0.25, y: -1 });
    const c1 = { x: a.x + leave.x * d * 0.4, y: a.y + leave.y * d * 0.4 };
    const c2 = { x: z.x - arrive.x * d * 0.42, y: z.y - arrive.y * Math.min(d * 0.42, (a.y - z.y) * 0.75) };
    return cubic(a, c1, c2, z, clamp(Math.round(d / 12), 12, 32));
  };

  // --- the crown: limbs to every family of ancestors ----------------------------

  const grow = (node: Node, width: number, direction: number) => {
    const total = node.sides.reduce((s, x) => s + (x.parent ? x.parent.weight : CROWN), 0) + LOSS;
    for (const side of node.sides) {
      const w0 = Math.max(minW, width * Math.sqrt((side.parent ? side.parent.weight : CROWN) / total));
      if (!side.parent) {
        crown(node.fork, w0, side.lean, seeded(`${node.id}:${side.lean}`));
        continue;
      }
      // Each limb leaves the fork turned a little towards its own side.
      const line = limbLine(node.fork, side.parent, direction + side.lean * 0.45);
      const w1 = Math.max(minW, w0 * 0.82);
      addWood(line, w0, w1, width, true, hashSeed(side.parent.id));
      sprigsAlong(line, (t) => lerp(w0, w1, t), seeded(`sprigs:${side.parent.id}`));
      grow(side.parent, w1, UP);
    }
    // The crown of leaves covers the families above the couple; the trunk and first limbs stay bare.
    if (node !== root) crownPoints.push(keepIn(node.fork));
  };

  // --- the trunk -------------------------------------------------------------------

  const trunkW = S * clamp(0.11 + 0.055 * Math.sqrt(root.weight), 0.16, 0.42);
  const bottom = root.at.y + H / 2;
  const base: Pt = { x: root.at.x, y: Math.min(bottom + clamp(spaceBelow(bottom) * 0.55, H * 0.35, H * 1.3), room.y + room.h - H * 0.2) };
  const sway = trunkW * 0.1;
  const trunkLine = cubic(
    base,
    { x: base.x + sway, y: lerp(base.y, root.fork.y, 0.35) },
    { x: base.x - sway, y: lerp(base.y, root.fork.y, 0.7) },
    root.fork,
    16,
  );
  const trunkWidth = (t: number) => trunkW * (1 + 0.55 * Math.pow(1 - t, 3));
  wood.push(outline(trunkLine, trunkWidth, 0.06, 1));
  bark.push(
    offsetLine(trunkLine, trunkWidth, 0.5, 0.05, 0.8),
    offsetLine(trunkLine, trunkWidth, -0.35, 0.1, 0.92),
    offsetLine(trunkLine, trunkWidth, 0.1, 0.25, 0.7),
    offsetLine(trunkLine, trunkWidth, -0.72, 0.02, 0.5),
  );
  grow(root, trunkW, UP);
  if (leafiness > 0) canopy(foliage, crownPoints, { spread, leafLen, rnd: seeded(`canopy:${root.id}`) });

  // --- the roots: down to children and grandchildren ---------------------------------

  const placed = new Set<string>(present);
  const descendantsOf = (id: string, depth: number): number =>
    depth > 6 ? 0 : index.children(id).reduce((s, c) => s + (cardOf.has(c.id) ? 1 + descendantsOf(c.id, depth + 1) : 0), 0);

  const rootLine = (a: Pt, card: { x: number; y: number; w: number; h: number }): Pt[] => {
    const entry = { x: card.x + card.w / 2, y: card.y };
    const centre = { x: entry.x, y: card.y + card.h / 2 };
    if (entry.y <= a.y + 4) return cubic(a, a, centre, centre, 8);
    const d = Math.hypot(entry.x - a.x, entry.y - a.y);
    const toward = normalize({ x: entry.x - a.x, y: entry.y - a.y });
    const leave = normalize({ x: toward.x * 0.85, y: toward.y * 0.85 + 0.15 });
    const c1 = { x: a.x + leave.x * d * 0.42, y: a.y + leave.y * d * 0.42 };
    const c2 = { x: entry.x, y: entry.y - Math.min(d * 0.4, (entry.y - a.y) * 0.8) };
    const line = cubic(a, c1, c2, entry, clamp(Math.round(d / 12), 12, 28));
    line.push(centre);
    return line;
  };

  /** Thin rootlets along a root, reaching down and out. */
  const rootlets = (line: Pt[], width: (t: number) => number, rnd: () => number) => {
    const s = lengths(line);
    const total = s[s.length - 1];
    let side = rnd() < 0.5 ? 1 : -1;
    let i = 0;
    for (let at = S * 0.3; at < total * 0.8; at += S * (0.35 + rnd() * 0.3)) {
      while (i + 1 < s.length && s[i + 1] < at) i++;
      const tg = tangent(line, i);
      const a = towards(Math.atan2(tg.y, tg.x) + side * (0.8 + rnd() * 0.3), Math.PI / 2, 0.3);
      side = -side;
      if (Math.sin(a) < 0.15) continue;
      const twig = twigLine(line[i], a, S * (0.14 + rnd() * 0.12), rnd);
      if (twig) addWood(twig, Math.max(minW, width(at / total) * 0.22), minW * 0.8, width(at / total) * 0.4, false);
    }
  };

  const rootsTo = (from: Pt, width: number, childIds: string[], flare: number, depth: number): number => {
    const kids = childIds.filter((id) => cardOf.has(id) && !placed.has(id));
    kids.forEach((id) => placed.add(id));
    const weights = kids.map((id) => 1 + descendantsOf(id, depth));
    const total = weights.reduce((s, w) => s + w, 0) + flare + LOSS;
    kids.forEach((id, i) => {
      const card = cardOf.get(id)!;
      const w0 = Math.max(minW, width * Math.sqrt(weights[i] / total) * 0.82);
      const w1 = Math.max(minW, w0 * 0.68);
      const line = rootLine(from, card);
      addWood(line, w0, w1, width * 0.9, true, hashSeed(id));
      rootlets(line.slice(0, -1), (t) => lerp(w0, w1, t), seeded(`root:${id}`));
      const grandchildren = index.children(id).map((c) => c.id);
      if (grandchildren.some((g) => cardOf.has(g) && !placed.has(g))) {
        const below = card.y + card.h;
        const knot = { x: card.x + card.w / 2, y: below + clamp(spaceBelow(below) * 0.3, 6, H * 0.4) };
        addWood([{ x: knot.x, y: card.y + card.h / 2 }, knot], w1, w1, w1, false);
        rootsTo(knot, w1, grandchildren, 0, depth + 1);
      }
    });
    return kids.length;
  };

  const childIds = present.flatMap((id) => index.children(id).map((c) => c.id)).filter((id, i, all) => all.indexOf(id) === i);
  const baseW = trunkWidth(0);
  const rooted = rootsTo(base, baseW, childIds, 1.2, 0);

  // Where the trunk meets the ground it flares into a few short roots.
  const rnd = seeded(`flare:${root.id}`);
  const flares = rooted ? [-1, 1] : [-1, -0.45, 0.45, 1];
  for (const side of flares) {
    const angle = Math.PI / 2 - side * (rooted ? 1.25 : 0.95 + rnd() * 0.2);
    const l = fit(base, angle, S * (rooted ? 0.42 : 0.5) * (0.85 + rnd() * 0.3));
    if (l === null) continue;
    const from = { x: base.x + side * baseW * 0.18, y: base.y - baseW * 0.05 };
    const end = { x: from.x + Math.cos(angle) * l, y: from.y + Math.sin(angle) * l };
    const line = cubic(from, { x: from.x + side * l * 0.45, y: from.y + l * 0.02 }, { x: end.x - side * l * 0.2, y: end.y - l * 0.12 }, end, 12);
    const w0 = baseW * (rooted ? 0.42 : 0.38);
    wood.push(outline(line, (t) => lerp(w0, minW, Math.pow(t, 0.7)), 0.05, side));
  }

  return { wood, twigs, bark: bark.filter(Boolean), foliage };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalize(p: Pt): Pt {
  const d = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / d, y: p.y / d };
}

/** Turns an angle a share of the way towards another. */
function towards(a: number, target: number, share: number): number {
  let d = target - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * share;
}

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  return h / 97;
}
