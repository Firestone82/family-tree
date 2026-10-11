import { moveCards } from '../model/arrangement';
import { sampleDocument } from '../model/sample';
import { TreeIndex } from '../model/tree-index';
import { DEFAULT_PRINT, Person, PrintSettings, TreeDocument } from '../model/types';
import { computeLayout } from '../layout/layout';
import { pdfFromJpeg } from './pdf';
import { flipLayout, renderPoster } from './poster';
import { RELATIVES, relativesOf, relativesSettings, scopeDocument } from './scope';
import { POSTER_THEMES, posterTheme } from './themes';
import { threeSpouses } from '../testing/fixtures';

const measure = (text: string, font: string) => text.length * Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12) * 0.5;

describe('print scope', () => {
  const doc = sampleDocument();
  const index = new TreeIndex(doc);
  const ids = (s: { people: ReadonlySet<string> }) => [...s.people].sort();

  it('keeps the direct line and partners', () => {
    const s = scopeDocument(doc, index, { centerId: 'I11', partnerId: 'I15', ancestors: 1, descendants: 1, branches: 0 });
    // Simon, Šárka, their parents, Simon's children, and the partners of all of them.
    expect(ids(s)).toEqual(['I11', 'I14', 'I15', 'I16', 'I17', 'I20', 'I21', 'I22', 'I25', 'I26', 'I6', 'I9'].sort());
    expect(s.doc.people.map((p) => p.id)).not.toContain('I12');
    expect(s.doc.families.every((f) => f.partners.every((p) => s.people.has(p)))).toBe(true);
  });

  it('adds siblings, nieces and nephews one branch out', () => {
    const s = scopeDocument(doc, index, { centerId: 'I11', partnerId: 'I15', ancestors: 1, descendants: 1, branches: 1 });
    for (const id of ['I12', 'I13', 'I18', 'I23', 'I24']) expect(s.people.has(id)).toBe(true);
    // Aunts and uncles need the grandparents' generation.
    expect(s.people.has('I7')).toBe(false);
    const wider = scopeDocument(doc, index, { centerId: 'I11', partnerId: 'I15', ancestors: 2, descendants: 1, branches: 1 });
    expect(wider.people.has('I7')).toBe(true);
    expect(wider.people.has('I19')).toBe(false);
  });

  it('takes everyone when nothing is limited', () => {
    const s = scopeDocument(doc, index, { centerId: 'I11', ancestors: 'all', descendants: 'all', branches: 'all' });
    expect(s.people.size).toBe(doc.people.length);
  });

  it('leaves out the families of those who married in, but not their partners', () => {
    // Marco's parents, and a later wife of his.
    const person = (id: string, sex: Person['sex']): Person => ({ id, sex, name: { given: id, surname: 'Ferri' } });
    const married: TreeDocument = {
      ...doc,
      people: [...doc.people, person('P1', 'male'), person('P2', 'female'), person('P3', 'female')],
      families: [
        ...doc.families,
        { id: 'F90', kind: 'marriage', partners: ['P1', 'P2'], children: [{ personId: 'I18', relation: 'biological' }] },
        { id: 'F91', kind: 'marriage', partners: ['I18', 'P3'], children: [] },
      ],
    };
    const options = { centerId: 'I11', partnerId: 'I15', ancestors: 'all', descendants: 'all' } as const;
    const all = scopeDocument(married, new TreeIndex(married), { ...options, ...relativesSettings('everyone') });
    const kin = scopeDocument(married, new TreeIndex(married), { ...options, ...relativesSettings('relatives') });
    expect(all.people.size).toBe(32);
    // Everyone else has a relationship name as seen from Simon: Marco is his brother-in-law.
    expect([...all.people].filter((id) => !kin.people.has(id)).sort()).toEqual(['P1', 'P2']);
    expect(kin.people.has('P3')).toBe(true);
    expect(kin.doc.families.some((f) => f.id === 'F90')).toBe(false);
    // Nearer steps leave them out anyway.
    const cousins = scopeDocument(married, new TreeIndex(married), { ...options, ...relativesSettings('cousins') });
    expect(cousins.people.has('P1')).toBe(false);
  });

  it('saves each step of Relatives as side branches and in-law families', () => {
    for (const r of RELATIVES) expect(relativesOf(relativesSettings(r))).toBe(r);
    expect(relativesOf({ branches: 3, inLawFamilies: true })).toBe('everyone');
    expect(relativesSettings('relatives')).toEqual({ branches: 'all', inLawFamilies: false });
  });
});

describe('printed page', () => {
  const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));
  const settings = (patch: Partial<PrintSettings> = {}): PrintSettings => ({ ...DEFAULT_PRINT, ...patch });

  it('draws every style as well-formed SVG with the title and everyone in it', () => {
    for (const theme of POSTER_THEMES) {
      const result = renderPoster({ doc, settings: settings({ theme: theme.id }), measure, now: new Date(2026, 9, 10) });
      const dom = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(result.svg).toContain('The Ashworth family');
      expect(result.people).toBe(29);
      expect(result.paper?.landscape).toBe(true);
      expect(result.svg).toContain('width="420mm"');
      expect(result.centerId).toBe('I11');
      expect(result.partnerId).toBe('I15');
    }
  });

  it('writes relationship names, couples and surnames at birth in the language the tree was saved in', () => {
    const cs = { ...doc, view: { ...doc.view, language: 'cs' } };
    const result = renderPoster({ doc: cs, settings: settings(), measure });
    expect(result.svg).toContain('Tchyně');
    expect(result.svg).toContain('5 generací, 29 osob');
    // Under a couple only what their marker does not say; no dates or places of a wedding.
    expect(result.svg).toContain('rozvedeni');
    expect(result.svg).not.toContain('sňatek 1991');
    // The surname at birth on its own line.
    expect(result.svg).toContain('>roz. Nováková<');
  });

  it('writes in the language it is given, whatever the tree was saved in', () => {
    const result = renderPoster({ doc, settings: settings(), language: 'cs', measure });
    expect(doc.view.language).toBe('en');
    expect(result.svg).toContain('Tchyně');
    expect(result.svg).not.toContain('Mother-in-law');
  });

  it('notes how every couple stands, whatever the settings saved in the file', () => {
    const result = renderPoster({ doc, settings: settings({ showUnions: false }), measure });
    for (const note of ['married', 'divorced', 'engaged']) expect(result.svg).toContain(`>${note}<`);
  });

  it('draws curved lines when the chart has them, in styles with lines of their own kind', () => {
    const lineData = (svg: string) => [...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="#4b3828"/g)].map((m) => m[1]);
    const square = lineData(renderPoster({ doc, settings: settings({ theme: 'heirloom' }), measure }).svg);
    const curved = lineData(renderPoster({ doc, settings: settings({ theme: 'heirloom' }), lines: 'curved', measure }).svg);
    expect(square.some((d) => d.includes('Q'))).toBe(true);
    expect(curved.length).toBe(square.length);
    expect(curved.some((d) => d.includes('Q'))).toBe(false);
    expect(curved.some((d) => d.includes('C'))).toBe(true);
    // Botanical draws branches of its own, whatever the chart has.
    const now = new Date(2026, 9, 11);
    const botanical = (lines: 'square' | 'curved') =>
      renderPoster({ doc: threeSpouses(), settings: settings({ theme: 'botanical' }), lines, measure, now }).svg;
    expect(botanical('curved')).toBe(botanical('square'));
  });

  it('makes a card wider for a relationship name that does not fit', () => {
    const cs = { ...doc, view: { ...doc.view, language: 'cs' } };
    // Seen from Luca, Ruth is his uncle Simon's former wife: too long for the usual card.
    const result = renderPoster({ doc: cs, settings: settings({ centerId: 'I23' }), measure });
    expect(result.svg).toContain('>Bývalá manželka strýce<');
    expect(result.svg).not.toContain('Bývalá manželka str…');
  });

  it('can turn a layout upside down for styles that grow upwards', () => {
    const layout = computeLayout(doc);
    const flipped = flipLayout(layout);
    const top = (l: typeof layout, id: string) => l.cards.find((c) => c.personId === id)!.y;
    expect(top(layout, 'I1')).toBeLessThan(top(layout, 'I29'));
    expect(top(flipped, 'I1')).toBeGreaterThan(top(flipped, 'I29'));
    expect(flipped.bounds).toEqual(layout.bounds);
  });

  it('draws the tree behind the chart and marks sex on the cards', () => {
    const plain = renderPoster({ doc, settings: settings({ showTree: false, showSex: false, sexColors: false }), measure });
    const decorated = renderPoster({ doc, settings: settings({ showTree: true, showSex: true, sexColors: true }), measure });
    expect(decorated.svg.length).toBeGreaterThan(plain.svg.length);
    const { palette, tree } = posterTheme('heirloom');
    expect(decorated.svg).toContain(palette.cardMale);
    expect(plain.svg).not.toContain(palette.cardMale);
    // Wood, a crown and leaves in the style's colours.
    expect(decorated.svg).toContain(`fill="${tree.wood}"`);
    expect(decorated.svg).toContain(`fill="${tree.leaves[0]}"`);
    expect(decorated.svg).toContain('fill="url(#pp-tree-crown)"');
    expect(plain.svg).not.toContain('pp-tree-crown');
    expect(plain.svg).not.toContain(`fill="${tree.leaves[0]}"`);
  });

  it("puts a picture of one's own behind the chart instead of the drawn tree", () => {
    const withPicture = { ...doc, background: { href: 'data:image/png;base64,iVBORw0K', width: 2000, height: 1000, fit: 'cover' as const, opacity: 0.5 } };
    const printed = renderPoster({ doc: withPicture, settings: settings({ showTree: true }), measure });
    expect(printed.svg).toContain('<image href="data:image/png;base64,iVBORw0K"');
    expect(printed.svg).toContain('opacity="0.5"');
    expect(printed.svg).not.toContain('pp-tree-crown');
    const without = renderPoster({ doc: withPicture, settings: settings({ showTree: false }), measure });
    expect(without.svg).not.toContain('iVBORw0K');
  });

  it('sizes a page to the tree, and falls back to known styles and papers', () => {
    const fit = renderPoster({ doc, settings: settings({ paper: 'fit' }), measure });
    expect(fit.paper).toBeUndefined();
    expect(fit.svg).not.toContain('mm"');
    const unknown = renderPoster({ doc, settings: settings({ theme: 'watercolour', paper: 'B7' }), measure });
    expect(unknown.theme.id).toBe('heirloom');
    expect(Math.round(unknown.paper!.widthMm)).toBe(420);
    expect(posterTheme('modern').id).toBe('modern');
  });

  it('prints someone whose name nobody knows as Unknown, on a dashed card', () => {
    const unknown = { ...doc, people: doc.people.map((p) => (p.id === 'I16' ? { ...p, name: { ...p.name, given: '' } } : p)) };
    for (const theme of POSTER_THEMES) {
      const known = renderPoster({ doc, settings: settings({ theme: theme.id }), measure });
      const printed = renderPoster({ doc: unknown, settings: settings({ theme: theme.id }), measure });
      expect(printed.svg).toContain('>Unknown<');
      expect(printed.svg).toContain('stroke-dasharray="4 2.6"');
      expect(known.svg).not.toContain('stroke-dasharray="4 2.6"');
    }
    const cs = renderPoster({ doc: { ...unknown, view: { ...unknown.view, language: 'cs' } }, settings: settings(), measure });
    expect(cs.svg).toContain('>Neznámý<');
  });

  it('prints the changes made by hand to the layout', () => {
    const plain = renderPoster({ doc, settings: settings(), measure });
    const arranged = moveCards(doc, ['I18', 'I12'], 200);
    expect(renderPoster({ doc: arranged, settings: settings(), measure }).svg).not.toBe(plain.svg);
    const part = scopeDocument(arranged, new TreeIndex(arranged), { centerId: 'I11', ancestors: 1, descendants: 1, branches: 1 });
    expect(part.doc.arrangement?.moves).toEqual({ I18: 200, I12: 200 });
  });

  it('prints a smaller part of the tree bigger', () => {
    const all = renderPoster({ doc, settings: settings(), measure });
    const close = renderPoster({ doc, settings: settings({ ancestors: 1, descendants: 1, branches: 0 }), measure });
    expect(close.people).toBeLessThan(all.people);
    expect(close.namePt).toBeGreaterThan(all.namePt);
  });
});

describe('PDF', () => {
  it('writes a valid one-page file around the image', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const blob = pdfFromJpeg(jpeg, 10, 20, 595.3, 841.9, 'Rodokmen Nováků');
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 595.3 841.9]');
    expect(text).toContain('/Width 10 /Height 20');
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
