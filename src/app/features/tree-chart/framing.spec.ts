import { computeLayout } from '../../core/layout/layout';
import { sampleDocument } from '../../core/model/sample';
import { TreeIndex } from '../../core/model/tree-index';
import { coupleCentre, fitView, floatOver, revealView } from './framing';
import { chartKey, neighbour } from './keyboard';

describe('pointing the chart', () => {
  const doc = sampleDocument();
  const layout = computeLayout(doc);
  const index = new TreeIndex(doc);
  const card = (id: string) => layout.cards.find((c) => c.personId === id)!;

  it('fits the whole tree on screen, no larger than 110%', () => {
    const screen = { w: 1000, h: 700 };
    const v = fitView(layout.bounds, screen, 40);
    const b = layout.bounds;
    expect(b.x * v.k + v.x).toBeGreaterThanOrEqual(40);
    expect((b.x + b.w) * v.k + v.x).toBeLessThanOrEqual(screen.w);
    expect(b.y * v.k + v.y).toBeGreaterThanOrEqual(0);
    expect((b.y + b.h) * v.k + v.y).toBeLessThanOrEqual(screen.h);
    expect(fitView({ x: 0, y: 0, w: 100, h: 50 }, screen, 0).k).toBe(1.1);
    expect(fitView({ x: 0, y: 0, w: 0, h: 0 }, screen, 0)).toEqual({ x: 500, y: 350, k: 1 });
  });

  it('centres a couple on the marker between them', () => {
    const simon = coupleCentre(layout, index, 'I11')!;
    // Simon's current partner is Šárka (his marriage to Ruth ended).
    const union = layout.unions.find((u) => u.familyId === index.familyBetween('I11', 'I15')!.id)!;
    expect(simon).toEqual({ x: union.cx, y: union.cy });
    // Someone with no partner is centred on their card.
    const c = card('I29');
    expect(coupleCentre(layout, index, 'I29')).toEqual({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
    expect(coupleCentre(layout, index, 'nobody')).toBeNull();
  });

  it('moves the view only as far as needed to show a card', () => {
    const c = card('I11');
    const screen = { w: 800, h: 600 };
    const centred = { x: screen.w / 2 - (c.x + c.w / 2), y: screen.h / 2 - (c.y + c.h / 2), k: 1 };
    expect(revealView(c, centred, screen)).toBeNull();
    const offLeft = { ...centred, x: centred.x - 600 };
    const moved = revealView(c, offLeft, screen)!;
    expect(c.x * moved.k + moved.x).toBe(40);
    expect(moved.y).toBe(offLeft.y);
    const over = floatOver(c, centred);
    expect(over.below).toBe(false);
    expect(over.left).toBeCloseTo(screen.w / 2);
  });

  it('reads the keys of the chart and moves between relatives', () => {
    const key = (k: string) => chartKey(new KeyboardEvent('keydown', { key: k }));
    expect(key('+')).toEqual({ kind: 'zoom', factor: 1.25 });
    expect(key('f')).toEqual({ kind: 'fit' });
    expect(key('ArrowUp')).toEqual({ kind: 'move', direction: 'up' });
    expect(key('x')).toBeNull();
    const parents = index.parents('I11').map((p) => p.id);
    expect(parents).toContain(neighbour(index, layout.cards, 'I11', 'up'));
    expect(index.children('I11').map((p) => p.id)).toContain(neighbour(index, layout.cards, 'I11', 'down'));
    const right = neighbour(index, layout.cards, 'I11', 'right')!;
    expect(card(right).y).toBe(card('I11').y);
    expect(card(right).x).toBeGreaterThan(card('I11').x);
  });
});
