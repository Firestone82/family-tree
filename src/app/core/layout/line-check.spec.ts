import { sampleDocument } from '../model/sample';
import { computeLayout } from './layout';
import { LayoutResult } from './layout-types';
import { lineProblems, partnersIn } from './line-check';

/** A layout with only the given lines: one family's stem, bar and drops each. */
function lines(connectors: { id: string; stem: [number, number]; barY: number; drops: [number, number][] }[]): LayoutResult {
  return {
    cards: [],
    placeholders: [],
    unions: [],
    links: [],
    rows: [],
    lanes: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    ranks: new Map(),
    crossings: 0,
    connectors: connectors.map((c) => ({
      familyId: c.id,
      stem: { x: c.stem[0], y: c.stem[1] },
      clearY: c.stem[1],
      barY: c.barY,
      drops: c.drops.map(([x, y], i) => ({ childId: `${c.id}${i}`, relation: 'biological' as const, x, points: [{ x, y }] })),
    })),
  };
}

describe('line check', () => {
  it("finds a stem crossing another family's bar", () => {
    // A's bar at y 100 from 0 to 400; B's stem comes down through it at x 150 to its own bar at y 110.
    const layout = lines([
      {
        id: 'A',
        stem: [100, 50],
        barY: 100,
        drops: [
          [0, 200],
          [400, 200],
        ],
      },
      { id: 'B', stem: [150, 50], barY: 110, drops: [[300, 200]] },
    ]);
    const p = lineProblems(layout, undefined, true);
    expect(p.crossings).toBe(1);
    expect(p.details[0]).toContain('A / B');
  });

  it("finds two families' lines on top of each other", () => {
    const layout = lines([
      {
        id: 'A',
        stem: [100, 50],
        barY: 100,
        drops: [
          [0, 200],
          [200, 200],
        ],
      },
      {
        id: 'B',
        stem: [300, 50],
        barY: 101,
        drops: [
          [150, 200],
          [400, 200],
        ],
      },
    ]);
    expect(lineProblems(layout).overlaps).toBe(1);
  });

  it("finds a line behind a card, and a card under another family's bar", () => {
    const layout = lines([
      {
        id: 'A',
        stem: [100, 50],
        barY: 100,
        drops: [
          [0, 200],
          [200, 200],
        ],
      },
    ]);
    layout.cards.push({ personId: 'A0', x: -40, y: 200, w: 80, h: 70, rank: 1 }, { personId: 'A1', x: 160, y: 200, w: 80, h: 70, rank: 1 });
    layout.cards.push({ personId: 'Z', x: 60, y: 200, w: 80, h: 70, rank: 1 }, { personId: 'W', x: 80, y: 60, w: 60, h: 20, rank: 0 });
    const p = lineProblems(layout, new Map(), true);
    // The stem passes behind W; Z stands under A's bar between A's children.
    expect(p.hidden).toBe(1);
    expect(p.under).toBe(1);
  });

  it('finds nothing wrong with the sample', () => {
    const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));
    const p = lineProblems(computeLayout(doc), partnersIn(doc), true);
    expect(p).toEqual({ crossings: 0, overlaps: 0, hidden: 0, under: 0, details: [] });
  });
});
