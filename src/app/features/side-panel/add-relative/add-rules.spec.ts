import { TreeIndex } from '../../../core/model/tree-index';
import { DocBuilder, nuclearFamily, threeSpouses } from '../../../core/testing/fixtures';
import { defaultSex, defaultSurname, excludedPeople, orphanChildren, partnerOptions, sharedSiblings } from './add-rules';

describe('adding a relative', () => {
  it('suggests the sex and surname a new relative most likely has', () => {
    const b = new DocBuilder();
    b.person('M', 'Marie', 'Nováková', 'female');
    b.person('K', 'Karel', 'Novák', 'male');
    b.family('F1', ['M'], ['K']);
    const index = new TreeIndex(b.build());
    // Karel's known parent is his mother, so the new one is probably his father, with his surname.
    expect(defaultSex(index, { relation: 'parent', personId: 'K' })).toBe('male');
    expect(defaultSurname(index, { relation: 'parent', personId: 'K' }, 'male', null)).toBe('Novák');
    expect(defaultSurname(index, { relation: 'parent', personId: 'K' }, 'female', null)).toBe('');
    // A partner is probably the other sex; a sibling and a son's child share the surname.
    expect(defaultSex(index, { relation: 'partner', personId: 'K' })).toBe('female');
    expect(defaultSurname(index, { relation: 'sibling', personId: 'K' }, 'female', null)).toBe('Novák');
    expect(defaultSurname(index, { relation: 'child', personId: 'K' }, 'unknown', null)).toBe('Novák');
    expect(defaultSex(index, { relation: 'child', personId: 'K' })).toBe('unknown');
  });

  it('gives Czech daughters, sisters and fathers the right form of the family name', () => {
    const b = new DocBuilder();
    b.person('P', 'Pavel', 'Mikula', 'male');
    b.person('J', 'Jana', 'Mikulová', 'female');
    b.family('F1', ['P', 'J']);
    const doc = b.build();
    const index = new TreeIndex({ ...doc, view: { ...doc.view, language: 'cs' } });
    // A daughter of Pavel and Jana is Mikulová, a son Mikula.
    expect(defaultSurname(index, { relation: 'child', personId: 'J' }, 'female', 'P')).toBe('Mikulová');
    expect(defaultSurname(index, { relation: 'child', personId: 'P' }, 'male', 'J')).toBe('Mikula');
    // Pavel's sister is Mikulová.
    expect(defaultSurname(index, { relation: 'sibling', personId: 'P' }, 'female', null)).toBe('Mikulová');
    // Jana's father is Mikula, the masculine form known from Pavel; her mother's surname is not guessed.
    expect(defaultSurname(index, { relation: 'parent', personId: 'J' }, 'male', null)).toBe('Mikula');
    expect(defaultSurname(index, { relation: 'parent', personId: 'J' }, 'female', null)).toBe('');
    // In an English tree the name stays as it is.
    expect(defaultSurname(new TreeIndex(doc), { relation: 'child', personId: 'J' }, 'female', 'P')).toBe('Mikula');
  });

  it('offers partners as the other parent and shares new parents with siblings', () => {
    const index = new TreeIndex(threeSpouses());
    expect(partnerOptions(index, 'P').map((p) => p.id)).toEqual(['S1', 'S2', 'S3']);
    // Both of Anna's parents are known, so a new parent shares nobody.
    expect(sharedSiblings(new TreeIndex(nuclearFamily()), { relation: 'parent', personId: 'I3' })).toBeNull();

    const b = new DocBuilder();
    b.person('M', 'Mum', 'Lee', 'female');
    b.person('A', 'Ann', 'Lee', 'female');
    b.person('B', 'Bob', 'Lee', 'male');
    b.family('F1', ['M'], ['A', 'B']);
    const single = new TreeIndex(b.build());
    expect(sharedSiblings(single, { relation: 'parent', personId: 'A' })).toEqual({ people: [single.person('B')], optional: true });
    expect(orphanChildren(single, { relation: 'partner', personId: 'M' })).toEqual({ familyId: 'F1', people: [single.person('A'), single.person('B')] });
    expect(orphanChildren(single, { relation: 'child', personId: 'M' })).toBeNull();
  });

  it('leaves out people who would make the tree loop', () => {
    const index = new TreeIndex(nuclearFamily());
    // Anna's parent cannot be her brother (who has parents) or herself.
    const parents = excludedPeople(index, { relation: 'parent', personId: 'I3' }, null, 'biological');
    expect(parents.has('I3')).toBe(true);
    expect(parents.has('I1')).toBe(true);
    // A partner of the father cannot be his child.
    const partners = excludedPeople(index, { relation: 'partner', personId: 'I1' }, null, 'biological');
    expect(partners.has('I3')).toBe(true);
    expect(partners.has('I2')).toBe(true);
    // A sibling cannot be a parent.
    expect(excludedPeople(index, { relation: 'sibling', personId: 'I3' }, null, 'biological').has('I1')).toBe(true);
  });
});
