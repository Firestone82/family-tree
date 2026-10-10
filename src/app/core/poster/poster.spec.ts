import { sampleDocument } from '../model/sample';
import { TreeIndex } from '../model/tree-index';
import { DEFAULT_PRINT, PrintSettings } from '../model/types';
import { computeLayout } from '../layout/layout';
import { pdfFromJpeg } from './pdf';
import { flipLayout, renderPoster } from './poster';
import { scopeDocument } from './scope';
import { POSTER_THEMES, posterTheme } from './themes';

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

  it('writes relationship names and marriages in the tree language', () => {
    const cs = { ...doc, view: { ...doc.view, language: 'cs' } };
    const result = renderPoster({ doc: cs, settings: settings(), measure });
    expect(result.svg).toContain('Tchyně');
    expect(result.svg).toContain('sňatek 1991');
    expect(result.svg).toContain('5 generací, 29 osob');
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
