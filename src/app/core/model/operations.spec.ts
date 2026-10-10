import {
  addChild,
  addParent,
  addPartner,
  addPerson,
  addSibling,
  deletePerson,
  moveChild,
  removeChild,
  removePartner,
  TreeOperationError,
  updatePerson,
} from './operations';
import { TreeIndex } from './tree-index';
import { emptyDocument, TreeDocument } from './types';

function start(): { doc: TreeDocument; me: string } {
  const { doc, personId } = addPerson(emptyDocument('Test'), { given: 'Me', surname: 'Root', sex: 'male', birth: { date: { value: '1990' } } });
  return { doc, me: personId };
}

describe('tree operations', () => {
  it('adds two parents into one family', () => {
    const { me, doc: first } = start();
    let doc = first;
    const a = addParent(doc, me, { draft: { given: 'Dad', surname: 'Root', sex: 'male' } });
    doc = a.doc;
    const b = addParent(doc, me, { draft: { given: 'Mum', sex: 'female' } });
    doc = b.doc;
    expect(a.familyId).toBe(b.familyId);
    const idx = new TreeIndex(doc);
    expect(
      idx
        .parents(me)
        .map((p) => p.name.given)
        .sort(),
    ).toEqual(['Dad', 'Mum']);
    expect(() => addParent(doc, me, { draft: { given: 'Third' } })).toThrow(TreeOperationError);
  });

  it('adds a partner with a status, such as a former wife', () => {
    const { doc, me } = start();
    const r = addPartner(doc, me, { draft: { given: 'Ex', sex: 'female' } }, { status: 'divorced' });
    const fam = r.doc.families.find((f) => f.id === r.familyId)!;
    expect(fam.kind).toBe('marriage');
    expect(fam.end?.reason).toBe('divorce');
    const engaged = addPartner(doc, me, { draft: { given: 'Fiancée', sex: 'female' } }, { status: 'engaged' });
    const f2 = engaged.doc.families.find((f) => f.id === engaged.familyId)!;
    expect(f2.kind).toBe('partnership');
    expect(f2.engagement).toEqual({});
  });

  it('gives adoptive parents a family of their own', () => {
    const { me, doc: first } = start();
    let doc = first;
    doc = addParent(doc, me, { draft: { given: 'Dad' } }).doc;
    doc = addParent(doc, me, { draft: { given: 'Mum' } }).doc;
    const adopt = addParent(doc, me, { draft: { given: 'Aunt' } }, 'adopted');
    const idx = new TreeIndex(adopt.doc);
    expect(idx.parentFamilies(me)).toHaveLength(2);
    expect(idx.primaryParentFamily(me)?.children[0].relation).toBe('biological');
    expect(idx.childRelation(idx.family(adopt.familyId)!, me)).toBe('adopted');
  });

  it('groups siblings with unknown parents and fills the parents in later', () => {
    const { me, doc: first } = start();
    let doc = first;
    const sib = addSibling(doc, me, { draft: { given: 'Sis', birth: { date: { value: '1988' } } } });
    doc = sib.doc;
    let idx = new TreeIndex(doc);
    expect(idx.family(sib.familyId)!.partners).toEqual([]);
    // Born earlier, so listed first.
    expect(idx.family(sib.familyId)!.children.map((c) => c.personId)).toEqual([sib.personId, me]);
    doc = addParent(doc, me, { draft: { given: 'Mum' } }).doc;
    idx = new TreeIndex(doc);
    expect(idx.parents(sib.personId).map((p) => p.name.given)).toEqual(['Mum']);
    expect(idx.family(sib.familyId)!.kind).toBe('marriage');
  });

  it('can give one child its own parents instead of sharing them with half-siblings', () => {
    const { me, doc: first } = start();
    let doc = first;
    doc = addParent(doc, me, { draft: { given: 'Mum' } }).doc;
    const half = addSibling(doc, me, { draft: { given: 'Half' } });
    doc = half.doc;
    const dad = addParent(doc, me, { draft: { given: 'Dad' } }, 'biological', { onlyThisChild: true });
    const idx = new TreeIndex(dad.doc);
    expect(
      idx
        .parents(me)
        .map((p) => p.name.given)
        .sort(),
    ).toEqual(['Dad', 'Mum']);
    expect(idx.parents(half.personId).map((p) => p.name.given)).toEqual(['Mum']);
  });

  it('adds children to the right family', () => {
    const { me, doc: first } = start();
    let doc = first;
    const wife = addPartner(doc, me, { draft: { given: 'Wife' } });
    doc = wife.doc;
    const kid = addChild(doc, me, { draft: { given: 'Kid' } }, { otherParentId: wife.personId });
    expect(kid.familyId).toBe(wife.familyId);
    const solo = addChild(kid.doc, me, { draft: { given: 'Solo' } }, { otherParentId: null });
    expect(solo.familyId).not.toBe(wife.familyId);
    const idx = new TreeIndex(solo.doc);
    expect(idx.family(solo.familyId)!.partners).toEqual([me]);
    expect(idx.children(me)).toHaveLength(2);
  });

  it('keeps children in birth order', () => {
    const { me, doc: first } = start();
    let doc = first;
    const w = addPartner(doc, me, { draft: { given: 'W' } });
    doc = w.doc;
    doc = addChild(doc, me, { draft: { given: 'B', birth: { date: { value: '2015' } } } }, { otherParentId: w.personId }).doc;
    doc = addChild(doc, me, { draft: { given: 'C' } }, { otherParentId: w.personId }).doc;
    doc = addChild(doc, me, { draft: { given: 'A', birth: { date: { value: '2012' } } } }, { otherParentId: w.personId }).doc;
    const fam = new TreeIndex(doc).family(w.familyId)!;
    const names = fam.children.map((c) => doc.people.find((p) => p.id === c.personId)!.name.given);
    expect(names).toEqual(['A', 'B', 'C']);
    const moved = moveChild(doc, w.familyId, fam.children[2].personId, -2);
    expect(new TreeIndex(moved).family(w.familyId)!.children[0].personId).toBe(fam.children[2].personId);
  });

  it('lets a single parent gain a partner who becomes the other parent', () => {
    const { me, doc: first } = start();
    let doc = first;
    const kid = addChild(doc, me, { draft: { given: 'Kid' } }, { otherParentId: null });
    doc = kid.doc;
    const partner = addPartner(doc, me, { draft: { given: 'Partner' } }, { joinFamilyId: kid.familyId });
    expect(partner.familyId).toBe(kid.familyId);
    expect(new TreeIndex(partner.doc).parents(kid.personId)).toHaveLength(2);
  });

  it('refuses links that would make someone their own ancestor', () => {
    const { me, doc: first } = start();
    let doc = first;
    const dad = addParent(doc, me, { draft: { given: 'Dad' } });
    doc = dad.doc;
    expect(() => addChild(doc, me, { existingId: dad.personId }, { otherParentId: null })).toThrow(/ancestor/);
    expect(() => addParent(doc, dad.personId, { existingId: me })).toThrow(/descendant/);
    expect(() => addPartner(doc, me, { existingId: dad.personId })).toThrow(TreeOperationError);
    expect(() => addParent(doc, me, { existingId: me })).toThrow(TreeOperationError);
  });

  it('refuses to give an existing person a second set of birth parents', () => {
    const { me, doc: first } = start();
    let doc = first;
    doc = addParent(doc, me, { draft: { given: 'Dad' } }).doc;
    const other = addPerson(doc, { given: 'Other' });
    doc = other.doc;
    expect(() => addChild(doc, other.personId, { existingId: me }, { otherParentId: null })).toThrow(/already has parents/);
    // As an adoptive parent it is fine.
    const adopted = addChild(doc, other.personId, { existingId: me }, { otherParentId: null, relation: 'adopted' });
    expect(new TreeIndex(adopted.doc).parentFamilies(me)).toHaveLength(2);
  });

  it('deletes a person and tidies up families', () => {
    const { me, doc: first } = start();
    let doc = first;
    const dad = addParent(doc, me, { draft: { given: 'Dad' } });
    doc = dad.doc;
    expect(doc.families).toHaveLength(1);
    doc = deletePerson(doc, me);
    // A parent with no children left records nothing, so the family goes.
    expect(doc.families).toHaveLength(0);
    expect(doc.people.map((p) => p.name.given)).toEqual(['Dad']);
  });

  it('keeps a childless couple when a child is removed', () => {
    const { me, doc: first } = start();
    let doc = first;
    const w = addPartner(doc, me, { draft: { given: 'W' } });
    const kid = addChild(w.doc, me, { draft: { given: 'Kid' } }, { otherParentId: w.personId });
    doc = removeChild(kid.doc, kid.familyId, kid.personId);
    expect(doc.families).toHaveLength(1);
    expect(doc.families[0].children).toHaveLength(0);
    doc = removePartner(doc, w.familyId, w.personId);
    expect(doc.families).toHaveLength(0);
  });

  it('updates and clears fields', () => {
    const { doc, me } = start();
    const next = updatePerson(doc, me, { occupation: 'Engineer', name: { nickname: 'Joe' } });
    expect(next.people[0].occupation).toBe('Engineer');
    expect(next.people[0].name.nickname).toBe('Joe');
    const cleared = updatePerson(next, me, { occupation: undefined, name: { nickname: undefined } });
    expect('occupation' in cleared.people[0]).toBe(false);
    expect('nickname' in cleared.people[0].name).toBe(false);
    expect(doc.people[0].occupation).toBeUndefined();
  });
});
