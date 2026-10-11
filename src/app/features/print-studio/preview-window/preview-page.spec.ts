import { PreviewPage, PreviewWords } from './preview-page';

const WORDS: PreviewWords = {
  title: 'Preview: The Ashworth family',
  summary: 'A3 landscape, 420 × 297 mm. 29 people.',
  note: { warn: false, text: 'Names print at 6.2 pt.' },
  preparing: 'Preparing the page…',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Whole page',
  actual: 'Actual size',
  lang: 'en',
};

/** A window of its own, as far as the page in it needs one. */
function fakeWindow(): { win: Window; doc: Document; listeners: Map<string, (e: Event) => void> } {
  const doc = document.implementation.createHTMLDocument('');
  const listeners = new Map<string, (e: Event) => void>();
  const win = { document: doc, addEventListener: (type: string, fn: (e: Event) => void) => listeners.set(type, fn) } as unknown as Window;
  return { win, doc, listeners };
}

describe('the page in a window of its own', () => {
  it('shows the page with what is printed, styled like the app', () => {
    const { win, doc } = fakeWindow();
    const page = new PreviewPage(win);
    page.showWords(WORDS, 'dark');
    expect(doc.title).toBe(WORDS.title);
    expect(doc.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(doc.querySelector('.pw-summary')?.textContent).toBe('A3 landscape, 420 × 297 mm. 29 people. Names print at 6.2 pt.');
    // The app's style sheets, found from the app's address.
    expect(doc.head.querySelector('base')?.getAttribute('href')).toBe(document.baseURI);

    expect(doc.querySelector<HTMLElement>('.pw-wait')?.hidden).toBe(false);
    page.showPage({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 7"><text>Ashworth</text></svg>', width: 1587, height: 1123 });
    expect(doc.querySelector('.pw-sheet svg')?.textContent).toBe('Ashworth');
    expect(doc.querySelector<HTMLElement>('.pw-wait')?.hidden).toBe(true);

    page.showWords({ ...WORDS, lang: 'cs', title: 'Náhled: Rodina' }, null);
    expect(doc.documentElement.lang).toBe('cs');
    expect(doc.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('zooms from the whole page in, and back', () => {
    const { win, doc, listeners } = fakeWindow();
    const page = new PreviewPage(win);
    page.showWords(WORDS, null);
    page.showPage({ svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', width: 1587, height: 1123 });
    const button = (label: string) => doc.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    const width = () => parseFloat(doc.querySelector<HTMLElement>('.pw-sheet')!.style.width);

    const fitted = width();
    expect(button('Whole page').disabled).toBe(true);
    expect(button('Zoom out').disabled).toBe(true);
    button('Zoom in').click();
    expect(width()).toBeGreaterThan(fitted);
    expect(button('Whole page').disabled).toBe(false);

    button('Actual size').click();
    expect(width()).toBe(1587);
    expect(doc.querySelector('.pw-percent')?.textContent).toBe('100%');

    // The keys do the same: 0 for the whole page.
    listeners.get('keydown')!(new KeyboardEvent('keydown', { key: '0' }));
    expect(width()).toBe(fitted);
  });
});
