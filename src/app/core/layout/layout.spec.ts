import { sampleDocument } from '../model/sample';
import { TreeIndex } from '../model/tree-index';
import { emptyDocument, TreeDocument } from '../model/types';
import {
  adoptionBothFamilies,
  cousinMarriage,
  crossGeneration,
  disconnected,
  DocBuilder,
  nuclearFamily,
  pedigree,
  randomFamily,
  threeSpouses,
  wideFamily,
} from '../testing/fixtures';
import { computeLayout, isotonic } from './layout';
import { COMFORTABLE_LAYOUT, LayoutResult, Pt } from './layout-types';
import { connectorPaths, linkPath } from './paths';

const fixtures: Record<string, () => TreeDocument> = {
  sample: () => sampleDocument(new Date('2026-01-01T00:00:00Z')),
  nuclear: nuclearFamily,
  threeSpouses,
  crossGeneration,
  cousinMarriage,
  disconnected,
  adoptionBothFamilies,
  wide: () => wideFamily(7),
  pedigree: () => pedigree(5),
  random: () => randomFamily(11, 90),
};

/** Points along a path of absolute M, L, Q and C commands, as the chart draws them. */
function pathPoints(d: string, steps = 24): Pt[] {
  const tokens = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: Pt[] = [];
  let i = 0;
  let cur: Pt = { x: 0, y: 0 };
  const pt = (): Pt => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  const along = (at: (t: number) => Pt) => {
    for (let s = 1; s <= steps; s++) out.push(at(s / steps));
  };
  while (i < tokens.length) {
    const command = tokens[i++];
    const from = cur;
    if (command === 'M') {
      cur = pt();
      out.push(cur);
    } else if (command === 'L') {
      const to = (cur = pt());
      along((t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }));
    } else if (command === 'Q') {
      const c = pt();
      const to = (cur = pt());
      along((t) => ({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * c.x + t ** 2 * to.x, y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * c.y + t ** 2 * to.y }));
    } else if (command === 'C') {
      const [a, b] = [pt(), pt()];
      const to = (cur = pt());
      const at = (p0: number, p1: number, p2: number, p3: number, t: number) =>
        (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
      along((t) => ({ x: at(from.x, a.x, b.x, to.x, t), y: at(from.y, a.y, b.y, to.y, t) }));
    } else {
      throw new Error(`Unexpected path command ${command} in ${d}`);
    }
  }
  return out;
}

function expectLinesClearOfCards(result: LayoutResult): void {
  const paths = [
    ...result.connectors.flatMap((c) => (['square', 'curved'] as const).flatMap((style) => connectorPaths(c, style).map((p) => p.d))),
    ...result.links.map(linkPath),
  ];
  for (const d of paths) {
    for (const pt of pathPoints(d)) {
      const behind = result.cards.find((c) => pt.x > c.x + 0.5 && pt.x < c.x + c.w - 0.5 && pt.y > c.y + 0.5 && pt.y < c.y + c.h - 0.5);
      expect(behind?.personId, `${d} at ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).toBeUndefined();
    }
  }
}

function expectNoOverlaps(result: LayoutResult, gap = 1): void {
  const byRow = new Map<number, LayoutResult['cards']>();
  for (const c of result.cards) byRow.set(c.y, [...(byRow.get(c.y) ?? []), c]);
  for (const cards of byRow.values()) {
    const sorted = [...cards].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].x).toBeGreaterThanOrEqual(sorted[i - 1].x + sorted[i - 1].w + gap);
    }
  }
}

describe('layout', () => {
  for (const [name, make] of Object.entries(fixtures)) {
    describe(name, () => {
      const doc = make();
      const result = computeLayout(doc);

      it('places every person exactly once', () => {
        expect(result.cards.map((c) => c.personId).sort()).toEqual(doc.people.map((p) => p.id).sort());
      });

      it('never overlaps cards', () => {
        expectNoOverlaps(result);
      });

      it('draws children below their parents', () => {
        const index = new TreeIndex(doc);
        const card = new Map(result.cards.map((c) => [c.personId, c]));
        for (const person of doc.people) {
          for (const parent of index.parents(person.id)) {
            expect(card.get(person.id)!.y).toBeGreaterThan(card.get(parent.id)!.y);
          }
        }
      });

      it('connects every primary child', () => {
        const index = new TreeIndex(doc);
        const dropped = new Set(result.connectors.flatMap((c) => c.drops.map((d) => d.childId)));
        for (const person of doc.people) {
          if (index.primaryParentFamily(person.id)) expect(dropped.has(person.id)).toBe(true);
        }
      });

      it('is deterministic', () => {
        expect(computeLayout(make())).toEqual(result);
      });

      it('produces drawable paths', () => {
        for (const c of result.connectors) {
          for (const style of ['square', 'curved'] as const) {
            for (const p of connectorPaths(c, style)) expect(p.d).toMatch(/^M[-\d.]+,[-\d.]+/);
          }
        }
      });

      it('never runs a line behind a card', () => {
        expectLinesClearOfCards(result);
      });
    });
  }

  it('lays out the sample without crossings, siblings in birth order', () => {
    const doc = fixtures['sample']();
    const result = computeLayout(doc);
    expect(result.crossings).toBe(0);
    // Five generations of people; the row for the Barlow sisters' unknown parents gets no number.
    expect(result.rows.map((r) => r.label)).toEqual(['I', 'II', 'III', 'IV', 'V']);
    expect(result.placeholders).toHaveLength(1);
    const x = new Map(result.cards.map((c) => [c.personId, c.x]));
    const index = new TreeIndex(doc);
    for (const fam of doc.families) {
      const xs = fam.children.map((c) => x.get(c.personId)!);
      const ascending = xs.every((v, i) => i === 0 || v > xs[i - 1]);
      const descending = xs.every((v, i) => i === 0 || v < xs[i - 1]);
      expect(ascending || descending).toBe(true);
    }
    // Partners sit side by side.
    for (const fam of doc.families.filter((f) => f.partners.length === 2)) {
      const [a, b] = fam.partners.map((p) => result.cards.find((c) => c.personId === p)!);
      expect(a.y).toBe(b.y);
      expect(index.familyBetween(a.personId, b.personId)).toBeTruthy();
    }
  });

  it('has no crossings for multiple marriages and cousin marriages', () => {
    expect(computeLayout(threeSpouses()).crossings).toBe(0);
    expect(computeLayout(cousinMarriage()).crossings).toBe(0);
    expect(computeLayout(pedigree(5)).crossings).toBe(0);
  });

  it('puts partners from different generations in one row', () => {
    const result = computeLayout(crossGeneration());
    const a = result.cards.find((c) => c.personId === 'A')!;
    const b = result.cards.find((c) => c.personId === 'B')!;
    expect(a.y).toBe(b.y);
  });

  it('shows secondary parents as extra links', () => {
    const result = computeLayout(adoptionBothFamilies());
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({ familyId: 'FA', childId: 'K', relation: 'adopted' });
  });

  it('survives ancestry loops in imported data', () => {
    const b = new DocBuilder();
    b.person('A', 'A');
    b.person('B', 'B');
    b.family('F1', ['A'], ['B']);
    b.family('F2', ['B'], ['A']);
    const result = computeLayout(b.build());
    expect(result.cards).toHaveLength(2);
  });

  it('handles an empty tree', () => {
    const result = computeLayout(emptyDocument());
    expect(result.cards).toEqual([]);
    expect(result.bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('keeps the previous order when given a hint', () => {
    const doc = fixtures['sample']();
    const first = computeLayout(doc);
    const hint = new Map(first.cards.map((c) => [c.personId, c.x + c.w / 2]));
    // Add a child to Harold and Margaret's brother Arthur's family and lay out again.
    const next: TreeDocument = {
      ...doc,
      people: [...doc.people, { id: 'NEW', sex: 'female', name: { given: 'New', surname: 'Ashworth' } }],
      families: doc.families.map((f) => (f.id === 'F4' ? { ...f, children: [...f.children, { personId: 'NEW', relation: 'biological' }] } : f)),
    };
    const second = computeLayout(next, COMFORTABLE_LAYOUT, hint);
    const order = (r: LayoutResult, y: number) =>
      r.cards
        .filter((c) => c.y === y && c.personId !== 'NEW')
        .sort((a, b) => a.x - b.x)
        .map((c) => c.personId);
    for (const row of first.rows) expect(order(second, row.y)).toEqual(order(first, row.y));
  });

  it('makes room for a card made wider', () => {
    const doc = fixtures['sample']();
    const result = computeLayout(doc, COMFORTABLE_LAYOUT, undefined, new Map([['I14', 260]]));
    const card = (id: string) => result.cards.find((c) => c.personId === id)!;
    expect(card('I14').w).toBe(260);
    expect(card('I11').w).toBe(COMFORTABLE_LAYOUT.cardWidth);
    expectNoOverlaps(result);
    expectLinesClearOfCards(result);
    // Simon and Ruth's marker stays in the gap between their cards; their children hang from it.
    const union = result.unions.find((u) => u.familyId === 'F5')!;
    const [left, right] = [card('I11'), card('I14')].sort((a, b) => a.x - b.x);
    expect(union.cx).toBeCloseTo((left.x + left.w + right.x) / 2, 5);
    expect(result.connectors.find((c) => c.familyId === 'F5')!.stem.x).toBeCloseTo(union.cx, 5);
  });

  it('uses the card size and gaps it is given', () => {
    // Print styles bring their own spacing.
    const options = { ...COMFORTABLE_LAYOUT, cardWidth: 156, cardHeight: 56, partnerGap: 36, siblingGap: 16, familyGap: 36, rowGap: 62 };
    const result = computeLayout(fixtures['sample'](), options);
    expectNoOverlaps(result);
    expect(result.cards[0].w).toBe(156);
    expect(result.cards[0].h).toBe(56);
  });

  it('lays out a few hundred people in reasonable time', () => {
    const doc = randomFamily(5, 250);
    const t0 = performance.now();
    const result = computeLayout(doc);
    const ms = performance.now() - t0;
    expectNoOverlaps(result);
    expect(ms).toBeLessThan(4000);
  });

  it('solves spacing constraints exactly', () => {
    // Two items that both want x = 0 must be 10 apart; the best split is -5 and 5.
    expect(isotonic([0, 0], [1, 1], [10])).toEqual([-5, 5]);
    // Unconstrained items stay where they want to be.
    expect(isotonic([0, 100], [1, 1], [10])).toEqual([0, 100]);
    // Heavier items move less.
    const [a, b] = isotonic([0, 0], [3, 1], [8]);
    expect(b - a).toBeCloseTo(8);
    expect(Math.abs(a)).toBeLessThan(Math.abs(b));
  });
});
