import { LayoutConnector, LayoutUnion, Pt } from './layout-types';
import { connectorPaths, unionLabelPoint, unionLinePath } from './paths';

/** The straight pieces of a path ('M', 'L' and the ends of curves), as segments. */
function straightSegments(d: string): { from: Pt; to: Pt }[] {
  const out: { from: Pt; to: Pt }[] = [];
  let at: Pt = { x: 0, y: 0 };
  for (const [, cmd, args] of d.matchAll(/([MLCQ])([^MLCQ]*)/g)) {
    const nums = args
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const end = { x: nums[nums.length - 2], y: nums[nums.length - 1] };
    if (cmd === 'L') out.push({ from: at, to: end });
    at = end;
  }
  return out;
}

const horizontal = (s: { from: Pt; to: Pt }) => Math.abs(s.to.y - s.from.y) < 0.5 && Math.abs(s.to.x - s.from.x) > 0.5;

describe('line paths', () => {
  // A family whose second child stands two rows down, past a row with other people in it.
  const connector: LayoutConnector = {
    familyId: 'F',
    stem: { x: 100, y: 40 },
    clearY: 70,
    barY: 109,
    drops: [
      { childId: 'A', relation: 'biological', x: 40, points: [{ x: 40, y: 148 }] },
      {
        childId: 'B',
        relation: 'biological',
        x: 260,
        points: [
          { x: 260, y: 257 },
          { x: 330, y: 257 },
          { x: 330, y: 296 },
        ],
        through: [{ x: 260, from: 148, to: 218 }],
      },
    ],
  };

  it('draws square lines along the bar, with rounded corners', () => {
    const [, far] = connectorPaths(connector, 'square');
    expect(straightSegments(far.d).some(horizontal)).toBe(true);
  });

  it('draws curved lines curved all the way, also to a child further down', () => {
    for (const p of connectorPaths(connector, 'curved')) {
      expect(straightSegments(p.d).some(horizontal), p.d).toBe(false);
      expect(p.d).toContain('C');
    }
    const [, far] = connectorPaths(connector, 'curved');
    // Straight down between the cards of the row it passes, and into the child's card from above.
    expect(far.d).toContain('L260,218');
    expect(far.d.endsWith('330,296')).toBe(true);
  });

  it('arches the line of partners with someone between them, when lines are curved', () => {
    const bridge: LayoutUnion = {
      familyId: 'F2',
      mode: 'bridge',
      kind: 'marriage',
      ended: false,
      cx: 380,
      cy: 35,
      rank: 0,
      line: [
        { x: 100, y: 0 },
        { x: 100, y: -15 },
        { x: 380, y: -15 },
        { x: 380, y: 35 },
        { x: 400, y: 35 },
      ],
    };
    const square = unionLinePath(bridge);
    const curved = unionLinePath(bridge, 'curved');
    expect(square).not.toContain('C');
    expect(curved.startsWith('M100,0C')).toBe(true);
    expect(straightSegments(curved).some((s) => horizontal(s) && s.from.y < 0)).toBe(false);
    // It still comes down beside the partner and runs on to their card.
    expect(curved.endsWith('L380,35L400,35')).toBe(true);
  });

  it('puts the note about a couple under them, or under the marker of partners in different rows', () => {
    const gap: LayoutUnion = { familyId: 'F', mode: 'gap', kind: 'marriage', ended: false, cx: 200, cy: 35, rank: 0, line: [] };
    expect(unionLabelPoint(gap, 70)).toEqual({ x: 200, y: 84 });
    const split: LayoutUnion = {
      ...gap,
      mode: 'split',
      line: [
        { x: 100, y: 35 },
        { x: 300, y: 183 },
      ],
    };
    expect(unionLabelPoint(split, 70)).toEqual({ x: 200, y: 128 });
    expect(unionLabelPoint({ ...gap, mode: 'single' }, 70)).toBeNull();
  });
});
