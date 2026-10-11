import { arrangementOf, isArranged, moveCards, moveLine, resetArrangement, resetCards, resetLine, setLeftPartner } from './arrangement';
import { sampleDocument } from './sample';

describe('changes made by hand to the layout', () => {
  const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));

  it('adds up moves and forgets those that come back to nothing', () => {
    let d = moveCards(doc, ['I18', 'I12'], 40);
    d = moveCards(d, ['I18', 'I12'], 12.34);
    expect(d.arrangement?.moves).toEqual({ I18: 52.3, I12: 52.3 });
    d = moveCards(d, ['I18', 'I12'], -52.3);
    expect(d.arrangement).toBeUndefined();
    expect(isArranged(d)).toBe(false);
  });

  it('moves lines, turns couples round and resets', () => {
    let d = moveLine(doc, 'F4', -12);
    d = moveLine(d, 'F4', -3);
    d = setLeftPartner(d, 'F8', 'I12');
    d = moveCards(d, ['I11'], 30);
    expect(arrangementOf(d)).toEqual({ moves: { I11: 30 }, lines: { F4: -15 }, left: { F8: 'I12' } });
    expect(isArranged(d)).toBe(true);
    expect(arrangementOf(resetLine(d, 'F4')).lines).toEqual({});
    expect(arrangementOf(resetCards(d, ['I11'])).moves).toEqual({});
    expect(resetArrangement(d).arrangement).toBeUndefined();
    // Undo works on whole documents, so the original is untouched.
    expect(doc.arrangement).toBeUndefined();
  });

  it('ignores changes for people and families no longer in the tree', () => {
    const d = { ...doc, arrangement: { moves: { I11: 30, I99: 10 }, lines: { F4: 5, F99: 5 }, left: { F8: 'I12', F4: 'I99', F98: 'I11' } } };
    expect(arrangementOf(d)).toEqual({ moves: { I11: 30 }, lines: { F4: 5 }, left: { F8: 'I12' } });
  });
});
