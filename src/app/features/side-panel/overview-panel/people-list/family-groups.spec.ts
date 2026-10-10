import { DocBuilder } from '../../../../core/testing/fixtures';
import { groupByFamily } from './family-groups';

describe('people grouped by family', () => {
  it('puts the forms of one name together, base form first, members oldest first', () => {
    const b = new DocBuilder();
    b.person('J', 'Jana', 'Mikulová', 'female', '1962');
    b.person('P', 'Pavel', 'Mikula', 'male', '1990');
    b.person('K', 'Karel', 'Mikula', 'male', '1960');
    b.person('C', 'Eva', 'Černá', 'female');
    b.person('D', 'Jan', 'Černý', 'male');
    b.person('A', 'Anna', 'Ashworth', 'female');
    b.person('X', 'Someone', '', 'unknown');
    const groups = groupByFamily(b.build().people, (a, c) => a.localeCompare(c, 'cs'));
    expect(groups.map((g) => g.spellings)).toEqual([['Ashworth'], ['Černý', 'Černá'], ['Mikula', 'Mikulová'], []]);
    expect(groups[2].members.map((p) => p.id)).toEqual(['K', 'J', 'P']);
    // People with no surname come last, under an empty key.
    expect(groups[3].key).toBe('');
    expect(groups[3].members.map((p) => p.id)).toEqual(['X']);
  });
});
