import { sampleDocument } from '../model/sample';
import { assignColors } from './tinctures';

describe('family colours', () => {
  const doc = sampleDocument();
  const byId = (id: string) => doc.people.find((p) => p.id === id)!;

  it('gives the largest family the first colour and shares it between spellings', () => {
    const { byPerson, legend } = assignColors(doc, 'family', new Map());
    expect(legend[0]).toMatchObject({ label: 'Ashworth', tincture: 'azure' });
    // Šárka was born Nováková; her father is Novák. One family, one colour.
    expect(byPerson.get('I15')).toBe(byPerson.get('I16'));
    expect(legend.find((l) => l.label === 'Novák')?.count).toBe(2);
    // Married-in women keep the colour of the family they were born into.
    expect(byPerson.get('I9')).toBe(byPerson.get('I4'));
    expect(byId('I9').name.surname).toBe('Ashworth');
  });

  it('leaves single members of a family neutral', () => {
    const { byPerson, legend } = assignColors(doc, 'family', new Map());
    expect(byPerson.get('I14')).toBe('argent'); // Ruth Kelly
    expect(legend[legend.length - 1]).toMatchObject({ label: 'Others', tincture: 'argent' });
  });

  it('colours by generation from the first row with people', () => {
    const ranks = new Map(doc.people.map((p, i) => [p.id, i < 5 ? 1 : 2]));
    const { byPerson, legend } = assignColors(doc, 'generation', ranks);
    expect(byPerson.get('I1')).toBe('azure');
    expect(legend.map((l) => l.label)).toEqual(['I', 'II']);
  });

  it('leaves people who are not on the chart out of the generations', () => {
    const ranks = new Map(doc.people.slice(0, 5).map((p) => [p.id, 1]));
    const { byPerson, legend } = assignColors(doc, 'generation', ranks);
    expect(legend).toEqual([{ key: '1', label: 'I', tincture: 'azure', count: 5 }]);
    expect(byPerson.get(doc.people[5].id)).toBe('argent');
  });

  it('keeps the colours of the whole tree in a part of it, and counts the part', () => {
    const all = assignColors(doc, 'family', new Map());
    // Only the Moreaus and one Ashworth.
    const part = { ...doc, people: doc.people.filter((p) => p.name.surname === 'Moreau' || p.id === 'I1') };
    const { byPerson, legend } = assignColors(part, 'family', new Map(), undefined, doc);
    for (const p of part.people) expect(byPerson.get(p.id)).toBe(all.byPerson.get(p.id));
    expect(legend.find((l) => l.label === 'Ashworth')).toMatchObject({ tincture: 'azure', count: 1 });
    expect(legend.some((l) => l.label === 'Novák')).toBe(false);
  });

  it('colours by sex', () => {
    const { byPerson } = assignColors(doc, 'sex', new Map());
    expect(byPerson.get('I1')).toBe('azure');
    expect(byPerson.get('I2')).toBe('sanguine');
  });
});
