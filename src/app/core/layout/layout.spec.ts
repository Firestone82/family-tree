import { moveCards, moveLine, setLeftPartner } from '../model/arrangement';
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
import { assignTracks, computeLayout, gapBetweenFamilies, isotonic } from './layout';
import { COMFORTABLE_LAYOUT, LayoutResult, Pt } from './layout-types';
import { lineProblems, partnersIn } from './line-check';
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

/**
 * Home: H. His brother M's daughter T is engaged to R; R's parents P1 and P2
 * are related to the rest only through R. The wives' sisters' families fill
 * the row on both sides, so R's parents cannot stand above him there.
 */
function marriedIn(childrenOfH = ['S1', 'S2']): TreeDocument {
  const b = new DocBuilder();
  const people: [string, string][] = [
    ['G1', 'male'],
    ['G2', 'female'],
    ['H', 'male'],
    ['W', 'female'],
    ['M', 'male'],
    ['K', 'female'],
    ['T', 'female'],
    ['R', 'male'],
    ['Q', 'female'],
    ['P1', 'male'],
    ['P2', 'female'],
    ['WP1', 'male'],
    ['WP2', 'female'],
    ['W2', 'female'],
    ['W2h', 'male'],
    ['W2k', 'female'],
    ['KP1', 'male'],
    ['KP2', 'female'],
    ['K2', 'female'],
    ['K2h', 'male'],
    ['K2k1', 'male'],
    ['K2k2', 'female'],
  ];
  for (const [id, sex] of people) b.person(id, id, id, sex as 'male' | 'female');
  for (const id of childrenOfH) b.person(id, id, id, 'unknown');
  b.family('FG', ['G1', 'G2'], ['H', 'M']);
  b.family('FH', ['H', 'W'], childrenOfH);
  b.family('FM', ['M', 'K'], ['T']);
  b.family('FTR', ['T', 'R'], [], { kind: 'partnership', engagement: {} });
  b.family('FP', ['P1', 'P2'], ['R', 'Q']);
  b.family('FWP', ['WP1', 'WP2'], ['W', 'W2']);
  b.family('FW2', ['W2', 'W2h'], ['W2k']);
  b.family('FKP', ['KP1', 'KP2'], ['K', 'K2']);
  b.family('FK2', ['K2', 'K2h'], ['K2k1', 'K2k2']);
  const doc = b.build();
  doc.meta.homePersonId = 'H';
  return doc;
}

/**
 * Home: R, engaged to T. R has a brother and a sister; T's mother K has a
 * sister H with children of her own, and T's father M a brother Ro who married
 * S, from a third family. Everyone's grandparents are in the tree.
 */
function engagedCousins(): TreeDocument {
  const b = new DocBuilder();
  const men = 'R R2 RF RFF RMF M Ro E1 TM1 VE1 St Vl Le W1 X1 A1 Hh V1 V2 B1 N1 Jn BP1 O Jh P D Pa'.split(' ');
  const women = 'T R3 RM RFM RMM K S E2 TM2 VE2 W2 X2 A2 H B2 N2 BP2 J Op A'.split(' ');
  for (const id of men) b.person(id, id, id, 'male');
  for (const id of women) b.person(id, id, id, 'female');
  b.family('FR', ['RF', 'RM'], ['R', 'R2', 'R3']);
  b.family('FRF', ['RFF', 'RFM'], ['RF']);
  b.family('FRM', ['RMF', 'RMM'], ['RM']);
  b.family('FRT', ['T', 'R'], [], { kind: 'partnership', engagement: {} });
  b.family('FT', ['M', 'K'], ['T']);
  b.family('FE', ['E1', 'E2'], ['Ro', 'M']);
  b.family('FTM', ['TM1', 'TM2'], ['E1', 'St', 'Vl']);
  b.family('FVE', ['VE1', 'VE2'], ['E2', 'Le']);
  b.family('FRo', ['Ro', 'S'], ['P', 'D']);
  b.family('FB', ['B1', 'B2'], ['S', 'O', 'J']);
  b.family('FN', ['N1', 'N2'], ['B1', 'Jn']);
  b.family('FBP', ['BP1', 'BP2'], ['B2']);
  b.family('FO', ['O', 'Op'], ['A']);
  b.family('FJ', ['J', 'Jh'], ['Pa']);
  b.family('FW', ['W1', 'W2'], ['K', 'H']);
  b.family('FX', ['X1', 'X2'], ['W1']);
  b.family('FA', ['A1', 'A2'], ['W2']);
  b.family('FH', ['H', 'Hh'], ['V1', 'V2']);
  const doc = b.build();
  doc.meta.homePersonId = 'R';
  return doc;
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

      it("never draws two families' lines on top of each other", () => {
        const problems = lineProblems(result, partnersIn(doc), true);
        expect(problems.overlaps, problems.details.join('; ')).toBe(0);
        expect(problems.hidden, problems.details.join('; ')).toBe(0);
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

  it('keeps families further apart the further back they are related', () => {
    expect(gapBetweenFamilies(COMFORTABLE_LAYOUT, 1)).toBe(COMFORTABLE_LAYOUT.siblingGap);
    expect(gapBetweenFamilies(COMFORTABLE_LAYOUT, 2)).toBe(COMFORTABLE_LAYOUT.familyGap);
    expect(gapBetweenFamilies(COMFORTABLE_LAYOUT, 3)).toBe(COMFORTABLE_LAYOUT.familyGap * 1.5);
    expect(gapBetweenFamilies(COMFORTABLE_LAYOUT, Infinity)).toBe(COMFORTABLE_LAYOUT.familyGap * 2);

    // Four generations from one couple: the youngest are siblings, first and second cousins.
    const b = new DocBuilder();
    b.person('A', 'A', 'Root', 'male');
    b.person('B', 'B', 'Root', 'female');
    b.family('F', ['A', 'B'], ['C1', 'C2']);
    let n = 0;
    const couple = (child: string, kids: string[]) => {
      b.person(child, child, 'Root', 'male');
      b.person(`${child}w`, `${child}w`, `Wife${n++}`, 'female');
      b.family(`F${child}`, [child, `${child}w`], kids);
    };
    couple('C1', ['D1', 'D2']);
    couple('C2', ['D3', 'D4']);
    couple('D1', ['E1', 'E2']);
    couple('D2', ['E3', 'E4']);
    couple('D3', ['E5', 'E6']);
    couple('D4', ['E7', 'E8']);
    for (let i = 1; i <= 8; i++) b.person(`E${i}`, `E${i}`, 'Root', 'unknown');
    const result = computeLayout(b.build());
    const card = (id: string) => result.cards.find((c) => c.personId === id)!;
    const gap = (a: string, z: string) => Math.abs(card(z).x - card(a).x) - card(a).w;
    expect(gap('E1', 'E2')).toBeCloseTo(COMFORTABLE_LAYOUT.siblingGap, 0);
    // First cousins (shared grandparents) stand further apart, second cousins further still.
    expect(gap('E2', 'E3')).toBeGreaterThanOrEqual(COMFORTABLE_LAYOUT.familyGap - 0.5);
    expect(gap('E4', 'E5')).toBeGreaterThanOrEqual(COMFORTABLE_LAYOUT.familyGap * 1.5 - 0.5);
    expectNoOverlaps(result);
  });

  it('gives the family of someone who married in a row of its own when theirs has no room', () => {
    const result = computeLayout(marriedIn());
    const card = (id: string) => result.cards.find((c) => c.personId === id)!;

    // R's parents have a row between their generation and R's, right above R.
    expect(result.lanes).toHaveLength(1);
    expect(card('P1').y).toBe(result.lanes[0].y);
    expect(card('P1').y).toBeGreaterThan(card('M').y);
    expect(card('P1').y).toBeLessThan(card('R').y);
    // Everyone else keeps their generation's row; the extra row has no number and counts with its generation.
    expect(card('K2').y).toBe(card('M').y);
    expect(result.rows.map((r) => r.label)).toEqual(['I', 'II', 'III']);
    expect(result.ranks.get('P1')).toBe(result.ranks.get('M'));
    // Nothing crosses, nobody stands under a family that is not theirs, and no line runs behind a card.
    expect(result.crossings).toBe(0);
    expectNoOverlaps(result);
    expectLinesClearOfCards(result);
    // The home couple's side never moves into an extra row, however crowded.
    for (const id of ['H', 'W', 'WP1', 'WP2', 'G1', 'G2']) expect(result.lanes.some((l) => l.y === card(id).y)).toBe(false);
  });

  it('keeps children in birth order, on straight lines, when the lines pass through an extra row', () => {
    const result = computeLayout(marriedIn(['S1', 'S2', 'S3']));
    const card = (id: string) => result.cards.find((c) => c.personId === id)!;
    const centre = (id: string) => card(id).x + card(id).w / 2;
    expect(result.lanes).toHaveLength(1);
    expect(card('H').y).toBeLessThan(result.lanes[0].y);
    expect(card('S1').y).toBeGreaterThan(result.lanes[0].y);
    // Eldest to youngest, read one way or the other.
    const [a, b, c] = ['S1', 'S2', 'S3'].map(centre);
    expect(a < b).toBe(b < c);
    // Each line turns only at the family's bar, then runs straight down into the child.
    const connector = result.connectors.find((x) => x.familyId === 'FH')!;
    expect(connector.drops).toHaveLength(3);
    for (const drop of connector.drops) {
      expect(drop.x).toBeCloseTo(centre(drop.childId), 1);
      for (const pt of drop.points) expect(pt.x).toBeCloseTo(centre(drop.childId), 1);
    }
    expect(result.crossings).toBe(0);
    expectNoOverlaps(result);
    expectLinesClearOfCards(result);
  });

  it('keeps brothers and sisters together, moving whole branches of the family past each other', () => {
    const doc = engagedCousins();
    const result = computeLayout(doc);
    const problems = lineProblems(result, partnersIn(doc), true);
    // Nobody stands between brothers and sisters who are not theirs, and no lines cross.
    expect(problems.under, problems.details.join('; ')).toBe(0);
    expect(problems.crossings, problems.details.join('; ')).toBe(0);
    expect(result.crossings).toBe(0);
    const card = (id: string) => result.cards.find((c) => c.personId === id)!;
    const between = (a: string, z: string) => {
      const [lo, hi] = [card(a).x, card(z).x].sort((p, q) => p - q);
      return result.cards.filter((c) => c.y === card(a).y && c.x > lo && c.x < hi).map((c) => c.personId);
    };
    // M's brother stands right by him, and so does K's sister by her, each on their own side of the couple.
    for (const [a, z] of [
      ['Ro', 'M'],
      ['K', 'H'],
      ['S', 'O'],
    ]) {
      expect(between(a, z).filter((id) => !['M', 'K', 'S', 'Ro', 'O', 'Op'].includes(id))).toEqual([]);
    }
    expectNoOverlaps(result);
    expectLinesClearOfCards(result);
  });

  it('gives a couple from two families a row of their own when a family stands between theirs', () => {
    const result = computeLayout(engagedCousins());
    const card = (id: string) => result.cards.find((c) => c.personId === id)!;
    // R and T stand together in a row of their own, below his brother and her cousins.
    const lane = result.lanes.find((l) => l.y === card('R').y);
    expect(lane).toBeDefined();
    expect(card('T').y).toBe(card('R').y);
    expect(card('R').y).toBeGreaterThan(card('R2').y);
    expect(card('R2').y).toBe(card('V1').y);
    // The extra row has no number: R and T still count with their generation.
    expect(result.ranks.get('R')).toBe(result.ranks.get('R2'));
    // Both families' lines come down past that generation without crossing anyone's.
    for (const familyId of ['FR', 'FT']) {
      const drop = result.connectors.find((c) => c.familyId === familyId)!.drops.find((d) => d.childId === 'R' || d.childId === 'T')!;
      expect(drop.points.length).toBeGreaterThan(1);
    }
    expect(lineProblems(result, partnersIn(engagedCousins())).crossings).toBe(0);
  });

  it('lays out the same again when given its own hint', () => {
    const doc = engagedCousins();
    const first = computeLayout(doc);
    const second = computeLayout(doc, COMFORTABLE_LAYOUT, first.hint);
    expect(second.cards).toEqual(first.cards);
    expect(second.lanes).toEqual(first.lanes);
    expect(second.connectors).toEqual(first.connectors);
  });

  it('stacks lines in a gap so that stems and drops cross as few other lines as possible', () => {
    // B starts further left, but on top its drop would cross A's bar and A's stem B's.
    const a = { lo: 100, hi: 300, key: 'A', up: [150], down: [300] };
    const b = { lo: 0, hi: 200, key: 'B', up: [0], down: [200] };
    const { track, count } = assignTracks([b, a]);
    expect(count).toBe(2);
    expect(track.get('A')).toBeLessThan(track.get('B')!);
    // Lines that do not share any of the gap share a track.
    expect(assignTracks([a, { lo: 400, hi: 600, key: 'C', up: [500], down: [400, 600] }]).count).toBe(1);
    // A stem coming down right where another family's line turns down to a child
    // would run along that line, so it ends higher, before reaching it.
    const d = { lo: 100, hi: 300, key: 'D', up: [200], down: [100, 300] };
    const e = { lo: 300.4, hi: 500, key: 'E', up: [300.4], down: [500] };
    expect(assignTracks([d, e]).track.get('E')).toBeLessThan(assignTracks([d, e]).track.get('D')!);
  });

  it('lets children leave birth order where that saves lines from crossing', () => {
    // Two brothers marry two sisters, and the middle brother marries a girl from
    // the other side. In birth order three lines would cross.
    const b = new DocBuilder();
    for (const id of ['X1', 'P', 'Y1', 'C1', 'C2', 'C3', 'D2']) b.person(id, id, id, 'male');
    for (const id of ['X2', 'Q', 'Y2', 'D1', 'D3']) b.person(id, id, id, 'female');
    b.family('FX', ['X1', 'X2'], ['D2']);
    b.family('FP', ['P', 'Q'], ['C1', 'C2', 'C3']);
    b.family('FY', ['Y1', 'Y2'], ['D1', 'D3']);
    b.family('F1', ['C1', 'D1']);
    b.family('F2', ['C2', 'D2']);
    b.family('F3', ['C3', 'D3']);
    const doc = b.build();
    doc.meta.homePersonId = 'P';
    const result = computeLayout(doc);
    const x = (id: string) => result.cards.find((c) => c.personId === id)!.x;
    expect(result.crossings).toBeLessThanOrEqual(1);
    expect(lineProblems(result, partnersIn(doc)).crossings).toBeLessThanOrEqual(1);
    // The middle brother stands at the end, next to his wife's family.
    expect(x('C2') < x('C1') === x('C2') < x('C3')).toBe(true);
    expectNoOverlaps(result);
    expectLinesClearOfCards(result);
  });

  describe('changes made by hand', () => {
    const doc = fixtures['sample']();
    const auto = computeLayout(doc);
    const card = (r: LayoutResult, id: string) => r.cards.find((c) => c.personId === id)!;
    const barY = (r: LayoutResult, familyId: string) => r.connectors.find((c) => c.familyId === familyId)!.barY;

    it('moves a couple sideways, and the neighbours make room', () => {
      const moved = computeLayout(moveCards(doc, ['I18', 'I12'], 120));
      const dx = card(moved, 'I18').x - card(auto, 'I18').x;
      expect(dx).toBeGreaterThan(110);
      expect(dx).toBeLessThan(120.5);
      expect(card(moved, 'I12').x - card(moved, 'I18').x).toBeCloseTo(card(auto, 'I12').x - card(auto, 'I18').x, 1);
      // The rest of the row stays put or makes room; nothing overlaps and no line runs behind a card.
      expect(card(moved, 'I11').x).toBeCloseTo(card(auto, 'I11').x, 0);
      expectNoOverlaps(moved);
      expectLinesClearOfCards(moved);
    });

    it('moves a couple past its neighbours when moved far enough', () => {
      expect(card(auto, 'I12').x).toBeGreaterThan(card(auto, 'I11').x);
      const moved = computeLayout(moveCards(doc, ['I18', 'I12'], -1200));
      expect(card(moved, 'I12').x).toBeLessThan(card(moved, 'I11').x);
      expectNoOverlaps(moved);
      expectLinesClearOfCards(moved);
    });

    it('turns a couple round', () => {
      const [left, right] = [card(auto, 'I18'), card(auto, 'I12')].sort((a, b) => a.x - b.x);
      const turned = computeLayout(setLeftPartner(doc, 'F8', right.personId));
      expect(card(turned, right.personId).x).toBeLessThan(card(turned, left.personId).x);
      expectNoOverlaps(turned);
      expectLinesClearOfCards(turned);
    });

    it('moves a family line down, and its gap grows to make room', () => {
      const moved = computeLayout(moveLine(doc, 'F4', 60));
      expect(barY(moved, 'F4') - barY(auto, 'F4')).toBeCloseTo(60, 1);
      // The children's row moves down with it, and the line stays clear of their cards.
      expect(card(moved, 'I11').y).toBeGreaterThan(card(auto, 'I11').y);
      expect(card(moved, 'I11').y - barY(moved, 'F4')).toBeGreaterThanOrEqual(10);
      expectLinesClearOfCards(moved);
    });

    it('keeps a line moved up clear of the row above', () => {
      const moved = computeLayout(moveLine(doc, 'F4', -500));
      expect(barY(moved, 'F4') - (card(moved, 'I6').y + card(moved, 'I6').h)).toBeCloseTo(10, 1);
      expect(card(moved, 'I11').y).toBe(card(auto, 'I11').y);
    });
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
