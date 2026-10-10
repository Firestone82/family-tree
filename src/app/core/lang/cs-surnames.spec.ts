import { czechSurnameFor, feminineSurname, masculineSurname } from './cs-surnames';

describe('Czech surnames', () => {
  it('gives the feminine form of a surname', () => {
    const cases: [string, string][] = [
      ['Novák', 'Nováková'],
      ['Mikula', 'Mikulová'],
      ['Svoboda', 'Svobodová'],
      ['Procházka', 'Procházková'],
      ['Černý', 'Černá'],
      ['Novotný', 'Novotná'],
      ['Krejčí', 'Krejčí'],
      ['Janů', 'Janů'],
      ['Marek', 'Marková'],
      ['Jelínek', 'Jelínková'],
      ['Vaněk', 'Vaňková'],
      ['Vlček', 'Vlčková'],
      ['Němec', 'Němcová'],
      ['Kadlec', 'Kadlecová'],
      ['Švec', 'Švecová'],
      ['Havel', 'Havlová'],
      ['Doležel', 'Doleželová'],
      ['Purkyně', 'Purkyňová'],
      ['Beneš', 'Benešová'],
      ['Ashworth', 'Ashworthová'],
      ['Nováková', 'Nováková'],
      ['van der Berg', 'van der Bergová'],
      ['Novák Svoboda', 'Nováková Svobodová'],
      ['NOVÁK', 'NOVÁKOVÁ'],
      ['novák', 'nováková'],
    ];
    for (const [man, woman] of cases) expect(feminineSurname(man), man).toBe(woman);
  });

  it('works back to the masculine form, preferring the men already in the tree', () => {
    expect(masculineSurname('Nováková')).toBe('Novák');
    expect(masculineSurname('Mikulová')).toBe('Mikula');
    expect(masculineSurname('Marková')).toBe('Marek');
    expect(masculineSurname('Vaňková')).toBe('Vaněk');
    expect(masculineSurname('Němcová')).toBe('Němec');
    expect(masculineSurname('Havlová')).toBe('Havel');
    expect(masculineSurname('Černá')).toBe('Černý');
    expect(masculineSurname('Krejčí')).toBe('Krejčí');
    expect(masculineSurname('Ashworth')).toBe('Ashworth');
    // The form alone would give Svobod and Procházek; a brother in the tree settles it.
    expect(masculineSurname('Svobodová', ['Novák', 'Svoboda'])).toBe('Svoboda');
    expect(masculineSurname('Procházková', ['Procházka'])).toBe('Procházka');
  });

  it('gives the form for a sex', () => {
    expect(czechSurnameFor('Mikula', 'female')).toBe('Mikulová');
    expect(czechSurnameFor('Mikulová', 'male')).toBe('Mikula');
    expect(czechSurnameFor('Mikula', 'male')).toBe('Mikula');
    expect(czechSurnameFor('Mikula', 'unknown')).toBe('Mikula');
    expect(czechSurnameFor('', 'female')).toBe('');
  });
});
