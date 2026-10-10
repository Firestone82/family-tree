import { sampleDocument } from '../model/sample';
import { TreeIndex } from '../model/tree-index';
import { DocBuilder } from '../testing/fixtures';
import { computeLayout } from './layout';
import { LayoutCard } from './layout-types';
import { treeShape } from './tree-shape';

/** Every x,y pair in path data. */
function points(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const m of d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) out.push({ x: Number(m[1]), y: Number(m[2]) });
  return out;
}

const inside = (p: { x: number; y: number }, c: LayoutCard) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;

describe('tree behind the chart', () => {
  const doc = sampleDocument();
  const layout = computeLayout(doc);
  const index = new TreeIndex(doc);
  const card = (id: string) => layout.cards.find((c) => c.personId === id)!;

  it('grows from the couple: limbs through their ancestors, leaves above, roots down to their descendants', () => {
    const shape = treeShape(layout, index, ['I11', 'I15'])!;
    expect(shape.wood.every((d) => d.startsWith('M') && d.endsWith('Z'))).toBe(true);
    const wood = [...shape.wood, ...shape.twigs].flatMap(points);

    // A limb passes the union of every family of ancestors: Simon's parents and grandparents, Šárka's parents.
    for (const familyId of ['F4', 'F1', 'F3', 'F7']) {
      const u = layout.unions.find((x) => x.familyId === familyId)!;
      expect(wood.some((p) => Math.abs(p.y - u.cy) < 30 && Math.abs(p.x - u.cx) < 60)).toBe(true);
    }
    // Roots reach behind the children and grandchildren.
    for (const id of ['I20', 'I21', 'I22', 'I27', 'I28', 'I29']) {
      expect(wood.some((p) => inside(p, card(id)))).toBe(true);
    }
    // A crown of leaves over the oldest generation, and none down among the descendants.
    const leaves = shape.foliage.leaves.flat().flatMap(points);
    const top = Math.min(...layout.cards.map((c) => c.y));
    expect(leaves.some((p) => p.y < top)).toBe(true);
    expect(leaves.every((p) => p.y < card('I22').y)).toBe(true);
    expect(shape.foliage.body.length).toBeGreaterThan(10);
  });

  it('stays in the room it is given and comes out the same every time', () => {
    const b = layout.bounds;
    const room = { x: b.x - 40, y: b.y - 120, w: b.w + 80, h: b.h + 200 };
    const a = treeShape(layout, index, ['I11', 'I15'], { room })!;
    const again = treeShape(layout, index, ['I11', 'I15'], { room })!;
    expect(again.wood).toEqual(a.wood);
    expect(again.foliage.leaves).toEqual(a.foliage.leaves);
    // The crown is kept inside the room; only the edges of its leaves may reach a little over.
    const margin = layout.cards[0].w * 0.4;
    for (const p of [...a.foliage.body, ...a.foliage.leaves.flat()].flatMap(points)) {
      expect(p.y).toBeGreaterThan(room.y - margin);
      expect(p.x).toBeGreaterThan(room.x - margin);
      expect(p.x).toBeLessThan(room.x + room.w + margin);
    }
  });

  it('can be drawn without leaves', () => {
    const bare = treeShape(layout, index, ['I11', 'I15'], { leaves: 0 })!;
    expect(bare.foliage.leaves.flat()).toEqual([]);
    expect(bare.wood.length).toBeGreaterThan(10);
  });

  it('works for someone alone, with no relatives', () => {
    const b = new DocBuilder();
    b.person('A', 'Alone');
    const single = b.build();
    const shape = treeShape(computeLayout(single), new TreeIndex(single), ['A'])!;
    // A trunk with a flare of roots, and a crown.
    expect(shape.wood.length).toBeGreaterThan(3);
    expect(shape.foliage.leaves.flat().length).toBeGreaterThan(10);
    expect(treeShape(computeLayout(single), new TreeIndex(single), ['missing'])).toBeNull();
  });
});
