import { chartLanguage, kinLabel } from '../lang/language';
import { sampleDocument } from '../model/sample';
import { TreeIndex } from '../model/tree-index';
import { TreeDocument } from '../model/types';
import { DocBuilder } from '../testing/fixtures';
import { kinship } from './kinship';

function labels(doc: TreeDocument, focus: string, lang = 'en'): Record<string, string> {
  const index = new TreeIndex(doc);
  const kin = kinship(index, focus);
  const language = chartLanguage(lang);
  const out: Record<string, string> = {};
  for (const p of doc.people) out[p.id] = kinLabel(language, kin.get(p.id), p.sex);
  return out;
}

describe('relationship names', () => {
  const doc = sampleDocument();

  it('names the example family from Simon in English', () => {
    const l = labels(doc, 'I11');
    expect(l).toMatchObject({
      I11: '',
      I6: 'Father',
      I9: 'Mother',
      I1: 'Grandfather',
      I2: 'Grandmother',
      I5: 'Grandmother',
      I3: 'Great-aunt',
      I7: 'Aunt',
      I8: 'Uncle',
      I10: 'Uncle',
      I19: 'Cousin',
      I12: 'Sister',
      I13: 'Brother',
      I14: 'Ex-wife',
      I15: 'Wife',
      I20: 'Daughter',
      I22: 'Son',
      I16: 'Father-in-law',
      I17: 'Mother-in-law',
      I18: 'Brother-in-law',
      I23: 'Nephew',
      I24: 'Niece',
      I25: 'Son-in-law',
      I26: 'Son’s fiancée',
      I27: 'Granddaughter',
      I29: 'Grandson',
    });
  });

  it('names the example family from Simon in Czech', () => {
    const l = labels(doc, 'I11', 'cs');
    expect(l).toMatchObject({
      I6: 'Otec',
      I9: 'Matka',
      I1: 'Dědeček',
      I3: 'Prateta',
      I7: 'Teta',
      I8: 'Strýc',
      I19: 'Sestřenice',
      I12: 'Sestra',
      I14: 'Bývalá manželka',
      I15: 'Manželka',
      I16: 'Tchán',
      I17: 'Tchyně',
      I18: 'Švagr',
      I23: 'Synovec',
      I24: 'Neteř',
      I25: 'Zeť',
      I26: 'Snoubenka syna',
      I27: 'Vnučka',
      I29: 'Vnuk',
    });
  });

  it('finds half-siblings and the ex-partner of a parent', () => {
    const en = labels(doc, 'I22');
    expect(en['I20']).toBe('Half-sister');
    expect(en['I21']).toBe('Half-brother');
    expect(en['I14']).toBe('Father’s ex-wife');
    expect(en['I26']).toBe('Fiancée');
    expect(en['I3']).toBe('Great-great-aunt');
    const cs = labels(doc, 'I22', 'cs');
    expect(cs['I20']).toBe('Polorodá sestra');
    expect(cs['I14']).toBe('Bývalá manželka otce');
    expect(cs['I3']).toBe('Praprateta');
  });

  it('describes cousins removed by generations', () => {
    const en = labels(doc, 'I29');
    expect(en['I19']).toBe('First cousin twice removed');
    expect(en['I1']).toBe('Great-great-grandfather');
    expect(en['I27']).toBe('Cousin');
    const cs = labels(doc, 'I29', 'cs');
    expect(cs['I19']).toBe('Sestřenice dědečka');
    expect(cs['I1']).toBe('Prapradědeček');
    const fromSophie = labels(doc, 'I19', 'cs');
    expect(fromSophie['I29']).toBe('Vnuk bratrance');
  });

  it('names step relations and partners of relatives', () => {
    const b = new DocBuilder();
    b.person('D', 'Dad', 'A', 'male');
    b.person('M', 'Mum', 'A', 'female');
    b.person('K', 'Kid', 'A', 'female');
    b.person('S', 'Stepdad', 'B', 'male');
    b.person('SC', 'Stepdad child', 'B', 'male');
    b.person('X', 'Stepdad ex', 'C', 'female');
    b.person('W', 'New wife', 'D', 'female');
    b.person('C1', 'Cousin', 'A', 'male');
    b.person('C1W', 'Cousin wife', 'E', 'female');
    b.person('GP', 'Grandpa', 'A', 'male');
    b.person('U', 'Uncle', 'A', 'male');
    b.person('AU', 'Aunt by marriage', 'F', 'female');
    b.family('F1', ['D', 'M'], ['K'], { end: { reason: 'divorce' } });
    b.family('F2', ['S', 'M'], []);
    b.family('F3', ['S', 'X'], ['SC'], { end: { reason: 'divorce' } });
    b.family('F4', ['D', 'W'], []);
    b.family('F5', ['GP'], ['D', 'U']);
    b.family('F6', ['U', 'AU'], ['C1']);
    b.family('F7', ['C1', 'C1W'], []);
    const l = labels(b.build(), 'K');
    expect(l).toMatchObject({
      S: 'Stepfather',
      W: 'Stepmother',
      SC: 'Stepbrother',
      U: 'Uncle',
      AU: 'Aunt',
      C1: 'Cousin',
      C1W: 'Cousin’s wife',
      GP: 'Grandfather',
    });
    const cs = labels(b.build(), 'K', 'cs');
    expect(cs).toMatchObject({ S: 'Nevlastní otec', W: 'Nevlastní matka', SC: 'Nevlastní bratr', AU: 'Teta', C1W: 'Manželka bratrance' });
    const fromS = labels(b.build(), 'S');
    expect(fromS['K']).toBe('Stepdaughter');
    expect(fromS['M']).toBe('Wife');
    expect(fromS['D']).toBe('Wife’s ex-husband');
  });

  it('calls adoptive and birth parents what they are', () => {
    const b = new DocBuilder();
    b.person('BM', 'Birth mum', '', 'female');
    b.person('AM', 'Adoptive mum', '', 'female');
    b.person('C', 'Child', '', 'male');
    b.family('F1', ['BM'], ['C']);
    b.family('F2', ['AM'], [['C', 'adopted']]);
    const l = labels(b.build(), 'C');
    expect(l['BM']).toBe('Birth mother');
    expect(l['AM']).toBe('Adoptive mother');
    expect(labels(b.build(), 'AM')['C']).toBe('Adopted son');
    expect(labels(b.build(), 'C', 'cs')['AM']).toBe('Adoptivní matka');
  });

  it('uses neutral words when sex is not recorded', () => {
    const b = new DocBuilder();
    b.person('P', 'Parent', '', 'unknown');
    b.person('C', 'Child', '', 'unknown');
    b.family('F1', ['P'], ['C']);
    expect(labels(b.build(), 'C')['P']).toBe('Parent');
    expect(labels(b.build(), 'P')['C']).toBe('Child');
    expect(labels(b.build(), 'P', 'cs')['C']).toBe('Dítě');
  });

  it('leaves unrelated people unnamed', () => {
    const b = new DocBuilder();
    b.person('A', 'A');
    b.person('B', 'B');
    const l = labels(b.build(), 'A');
    expect(l['B']).toBe('');
  });
});
