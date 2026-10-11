import { computeLayout } from '../../core/layout/layout';
import { arrangementOf, moveCards, moveLine } from '../../core/model/arrangement';
import { sampleDocument } from '../../core/model/sample';
import { TreeIndex } from '../../core/model/tree-index';
import { LINE_CLEARANCE, blockOf, coupleSwitches, lineGrips, lowestLineMove, movedBlocks, previewLayout } from './arrange';

describe('arranging by hand', () => {
  const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));
  const index = new TreeIndex(doc);
  const layout = computeLayout(doc);
  const card = (l: typeof layout, id: string) => l.cards.find((c) => c.personId === id)!;

  it('moves a whole block of partners: Simon with his wife and his ex-wife', () => {
    const { members, families } = blockOf(layout, index, 'I11');
    expect([...members].sort()).toEqual(['I11', 'I14', 'I15']);
    expect([...families].sort()).toEqual(['F5', 'F6']);
    expect(blockOf(layout, index, 'I18').members.sort()).toEqual(['I12', 'I18']);
  });

  it('shows a dragged couple and its lines where the pointer has them', () => {
    const { members, families } = blockOf(layout, index, 'I18');
    const shown = previewLayout(layout, { kind: 'card', members, families, dx: 50 });
    expect(card(shown, 'I18').x).toBe(card(layout, 'I18').x + 50);
    expect(card(shown, 'I11').x).toBe(card(layout, 'I11').x);
    // Their marker and the stem to their children follow; so does the drop to Claire from her parents.
    expect(shown.unions.find((u) => u.familyId === 'F8')!.cx).toBe(layout.unions.find((u) => u.familyId === 'F8')!.cx + 50);
    expect(shown.connectors.find((c) => c.familyId === 'F8')!.stem.x).toBe(layout.connectors.find((c) => c.familyId === 'F8')!.stem.x + 50);
    const drop = (l: typeof layout) => l.connectors.find((c) => c.familyId === 'F4')!.drops.find((d) => d.childId === 'I12')!;
    expect(drop(shown).points.at(-1)!.x).toBe(drop(layout).points.at(-1)!.x + 50);
    // The dragged cards are drawn last, over the others.
    expect(
      shown.cards
        .slice(-2)
        .map((c) => c.personId)
        .sort(),
    ).toEqual(['I12', 'I18']);
    expect(previewLayout(layout, null)).toBe(layout);
  });

  it('shows a dragged line, and keeps it clear of the parents above', () => {
    const shown = previewLayout(layout, { kind: 'line', familyId: 'F4', dy: 20 });
    expect(shown.connectors.find((c) => c.familyId === 'F4')!.barY).toBe(layout.connectors.find((c) => c.familyId === 'F4')!.barY + 20);
    const c = layout.connectors.find((x) => x.familyId === 'F4')!;
    expect(c.barY + lowestLineMove(layout, 'F4')).toBe(c.clearY + LINE_CLEARANCE);
  });

  it('offers a grip on every line with a bar, a button between partners, and puts back what moved', () => {
    const grips = lineGrips(layout, arrangementOf(doc));
    expect(grips.some((g) => g.familyId === 'F4' && !g.moved)).toBe(true);
    // Leo hangs straight below his parents: no bar, nothing to grab.
    expect(grips.some((g) => g.familyId === 'F11')).toBe(false);
    const switches = coupleSwitches(layout, index);
    const f8 = switches.find((s) => s.familyId === 'F8')!;
    expect(f8.right).toBe(card(layout, 'I18').x > card(layout, 'I12').x ? 'I18' : 'I12');

    const arranged = moveLine(moveCards(doc, ['I18', 'I12'], 40), 'F4', 10);
    const after = computeLayout(arranged);
    expect(lineGrips(after, arrangementOf(arranged)).find((g) => g.familyId === 'F4')!.moved).toBe(true);
    const moved = movedBlocks(after, new TreeIndex(arranged), arrangementOf(arranged));
    expect(moved).toHaveLength(1);
    expect(moved[0].members.sort()).toEqual(['I12', 'I18']);
  });
});
