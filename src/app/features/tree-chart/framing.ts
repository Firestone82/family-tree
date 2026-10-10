/**
 * Where to point the chart: views that show the whole tree, bring a couple to
 * the middle, or nudge a card into sight. Pure functions of the layout and the
 * size of the screen.
 */
import { LayoutBounds, LayoutCard, LayoutResult, Pt } from '../../core/layout/layout-types';
import { TreeIndex } from '../../core/model/tree-index';
import { currentPartner } from '../../state/chart-model';
import { MIN_ZOOM, View } from './viewport';

export interface Screen {
  w: number;
  h: number;
}

/** The whole tree, as large as fits (but not larger than 110%), leaving `gutter` on the left for row labels. */
export function fitView(bounds: LayoutBounds, screen: Screen, gutter: number): View {
  const { w, h } = screen;
  if (!bounds.w || !bounds.h) return { x: w / 2, y: h / 2, k: 1 };
  const padX = Math.min(64, w * 0.06) + gutter;
  const padY = Math.min(64, h * 0.08);
  const k = Math.max(MIN_ZOOM, Math.min((w - padX * 2) / bounds.w, (h - padY * 2) / bounds.h, 1.1));
  return { x: (w - bounds.w * k) / 2 - bounds.x * k + gutter / 2, y: (h - bounds.h * k) / 2 - bounds.y * k, k };
}

/** The middle of a card, or the marker between the person and their partner when they stand side by side. */
export function coupleCentre(layout: LayoutResult, index: TreeIndex, personId: string): Pt | null {
  const c = layout.cards.find((x) => x.personId === personId);
  if (!c) return null;
  const partnerId = currentPartner(index, personId);
  const family = partnerId ? index.familyBetween(personId, partnerId) : undefined;
  const union = family ? layout.unions.find((u) => u.familyId === family.id && (u.mode === 'gap' || u.mode === 'bridge')) : undefined;
  return union ? { x: union.cx, y: union.cy } : { x: c.x + c.w / 2, y: c.y + c.h / 2 };
}

/** The view moved just enough to show the card with a margin around it, or null when it is in sight. */
export function revealView(card: LayoutCard, view: View, screen: Screen): View | null {
  const { x, y, k } = view;
  const margin = 40;
  const left = card.x * k + x;
  const right = (card.x + card.w) * k + x;
  // Room above the card for the quick-add buttons.
  const top = card.y * k + y - 56;
  const bottom = (card.y + card.h) * k + y;
  let dx = 0;
  let dy = 0;
  if (left < margin) dx = margin - left;
  else if (right > screen.w - margin) dx = screen.w - margin - right;
  if (top < margin) dy = margin - top;
  else if (bottom > screen.h - margin) dy = screen.h - margin - bottom;
  return dx || dy ? { x: x + dx, y: y + dy, k } : null;
}

/** Where buttons float over a card, in screen pixels: above it, or below when it is near the top. */
export function floatOver(card: LayoutCard, view: View): { left: number; top: number; below: boolean } {
  const { x, y, k } = view;
  const top = card.y * k + y;
  const below = top < 70;
  return { left: card.x * k + x + (card.w * k) / 2, top: below ? (card.y + card.h) * k + y + 10 : top - 10, below };
}
