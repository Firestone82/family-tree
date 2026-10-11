import { ICONS } from '../../../shared/icon/icons';

/** The words the page in the preview window shows, in the app's language. */
export interface PreviewWords {
  /** The window's title: "Preview: The Ashworth family". */
  title: string;
  /** "A3 landscape, 420 × 297 mm. 29 people." */
  summary: string;
  /** How big the names print, and whether that is too small to read. */
  note: { warn: boolean; text: string } | null;
  preparing: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  actual: string;
  lang: string;
}

/** The largest zoom, against the real size of the paper. */
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.25;
/** Room around the page in the window. */
const MARGIN = 28;

/**
 * The page in a window of its own: the print preview as large as the window
 * allows, with zoom. It is built with the DOM of that window and styled by
 * the app's own style sheets, copied into it (`.preview-window` in
 * styles/_studio.scss), so it follows light and dark mode. Plain DOM, no
 * Angular: the window is another document.
 */
export class PreviewPage {
  private readonly doc: Document;
  private readonly heading: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly note: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly wait: HTMLElement;
  private readonly percent: HTMLElement;
  private readonly buttons: Record<'out' | 'in' | 'fit' | 'actual', HTMLButtonElement>;

  /** Size of the page in CSS pixels (96 per inch): zoom 1 is the real size. */
  private page = { w: 0, h: 0 };
  /** Null fits the page to the window; a number is the scale against the real size. */
  private zoom: number | null = null;
  private drag: { id: number; x: number; y: number; left: number; top: number } | null = null;

  constructor(private readonly win: Window) {
    this.doc = win.document;
    const doc = this.doc;
    copyStyles(document, doc);
    doc.body.className = 'preview-window';
    doc.body.replaceChildren();

    const bar = this.el('header', 'pw-bar');
    const about = this.el('div', 'pw-about');
    this.heading = this.el('h1', 'pw-title');
    this.summary = this.el('p', 'pw-summary');
    this.note = this.el('span', 'pw-note');
    about.append(this.heading, this.summary);
    const zoom = this.el('div', 'pw-zoom');
    this.buttons = {
      out: this.button('minus', () => this.zoomBy(1 / ZOOM_STEP)),
      in: this.button('plus', () => this.zoomBy(ZOOM_STEP)),
      fit: this.button('fit', () => this.setZoom(null), true),
      actual: this.button('', () => this.setZoom(1), true),
    };
    this.percent = this.el('span', 'pw-percent');
    zoom.append(this.buttons.out, this.percent, this.buttons.in, this.buttons.fit, this.buttons.actual);
    bar.append(about, zoom);

    this.stage = this.el('main', 'pw-stage');
    this.sheet = this.el('div', 'pw-sheet');
    this.wait = this.el('p', 'pw-wait');
    this.stage.append(this.sheet, this.wait);
    doc.body.append(bar, this.stage);

    // The page fits the room it has: the window can be resized, the bar can wrap, and the styles can arrive late.
    win.addEventListener('resize', () => this.layout());
    const Observer = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (Observer) new Observer(() => this.layout()).observe(this.stage);
    win.addEventListener('keydown', (e) => this.onKey(e));
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.stage.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.stage.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.stage.addEventListener('pointerup', () => this.endDrag());
    this.stage.addEventListener('pointercancel', () => this.endDrag());
  }

  /** The page as SVG markup and its size in CSS pixels, or null while it is being prepared. */
  showPage(page: { svg: string; width: number; height: number } | null): void {
    this.sheet.hidden = !page;
    this.wait.hidden = !!page;
    if (!page) return;
    const resized = page.width !== this.page.w || page.height !== this.page.h;
    this.page = { w: page.width, h: page.height };
    // Another paper size or orientation starts again from the whole page.
    if (resized) this.zoom = null;
    this.sheet.innerHTML = page.svg;
    this.layout();
  }

  showWords(words: PreviewWords, theme: string | null): void {
    const root = this.doc.documentElement;
    root.lang = words.lang;
    if (theme) root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    this.doc.title = words.title;
    this.heading.textContent = words.title;
    this.summary.replaceChildren(this.doc.createTextNode(words.summary));
    if (words.note) {
      this.note.textContent = words.note.text;
      this.note.classList.toggle('warn', words.note.warn);
      this.summary.append(' ', this.note);
    }
    this.wait.textContent = words.preparing;
    this.label(this.buttons.out, words.zoomOut);
    this.label(this.buttons.in, words.zoomIn);
    this.label(this.buttons.fit, words.fit, words.fit);
    this.label(this.buttons.actual, words.actual, words.actual);
  }

  private label(button: HTMLButtonElement, label: string, text?: string): void {
    button.title = label;
    button.setAttribute('aria-label', label);
    if (text !== undefined) {
      const span = button.querySelector('span');
      if (span) span.textContent = text;
    }
  }

  /** The scale at which the whole page fits the window. */
  private fitScale(): number {
    const w = Math.max(80, this.stage.clientWidth - MARGIN * 2);
    const h = Math.max(80, this.stage.clientHeight - MARGIN * 2);
    return this.page.w && this.page.h ? Math.min(w / this.page.w, h / this.page.h) : 1;
  }

  private layout(): void {
    if (!this.page.w) return;
    const fit = this.fitScale();
    const scale = this.zoom ?? fit;
    this.sheet.style.width = `${Math.round(this.page.w * scale)}px`;
    this.sheet.style.height = `${Math.round(this.page.h * scale)}px`;
    this.percent.textContent = `${Math.round(scale * 100)}%`;
    const zoomed = scale > fit + 1e-6;
    this.stage.classList.toggle('zoomed', zoomed);
    this.buttons.out.disabled = !zoomed;
    this.buttons.in.disabled = scale >= MAX_ZOOM - 1e-6;
    this.buttons.fit.disabled = this.zoom === null;
    this.buttons.actual.disabled = Math.abs(scale - 1) < 1e-6;
  }

  private zoomBy(factor: number): void {
    this.setZoom((this.zoom ?? this.fitScale()) * factor);
  }

  /** Zooms about the middle of what is in view. */
  private setZoom(zoom: number | null): void {
    const fit = this.fitScale();
    const next = zoom === null || zoom <= fit + 1e-6 ? null : Math.min(MAX_ZOOM, zoom);
    const s = this.stage;
    const cx = (s.scrollLeft + s.clientWidth / 2) / Math.max(1, s.scrollWidth);
    const cy = (s.scrollTop + s.clientHeight / 2) / Math.max(1, s.scrollHeight);
    this.zoom = next;
    this.layout();
    s.scrollLeft = cx * s.scrollWidth - s.clientWidth / 2;
    s.scrollTop = cy * s.scrollHeight - s.clientHeight / 2;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') this.zoomBy(ZOOM_STEP);
    else if (e.key === '-') this.zoomBy(1 / ZOOM_STEP);
    else if (e.key === '0') this.setZoom(null);
    else if (e.key === '1') this.setZoom(1);
    else return;
    e.preventDefault();
  }

  /** Ctrl and the wheel (or a pinch on a touchpad) zooms; the wheel alone scrolls. */
  private onWheel(e: WheelEvent): void {
    if (!e.ctrlKey) return;
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  }

  /** A zoomed page can be dragged around. */
  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || !this.stage.classList.contains('zoomed')) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: this.stage.scrollLeft, top: this.stage.scrollTop };
    this.stage.setPointerCapture(e.pointerId);
    this.stage.classList.add('dragging');
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.stage.scrollLeft = this.drag.left - (e.clientX - this.drag.x);
    this.stage.scrollTop = this.drag.top - (e.clientY - this.drag.y);
  }

  private endDrag(): void {
    this.drag = null;
    this.stage.classList.remove('dragging');
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
    const el = this.doc.createElement(tag);
    el.className = className;
    return el;
  }

  /** A button with one of the app's icons, and text when `withText` (filled in by showWords). */
  private button(icon: string, run: () => void, withText = false): HTMLButtonElement {
    const b = this.el('button', withText ? 'btn small' : 'btn small icon');
    b.type = 'button';
    if (icon && ICONS[icon]) {
      const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '15');
      svg.setAttribute('height', '15');
      svg.setAttribute('aria-hidden', 'true');
      const path = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', ICONS[icon]);
      for (const [k, v] of Object.entries({
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.9',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      })) {
        path.setAttribute(k, v);
      }
      svg.append(path);
      b.append(svg);
    }
    if (withText) b.append(this.doc.createElement('span'));
    b.addEventListener('click', run);
    return b;
  }
}

/**
 * Gives `to` the style sheets of `from`: links to the same files and copies
 * of inline styles, with `from`'s base address so that fonts and pictures
 * they refer to are found.
 */
function copyStyles(from: Document, to: Document): void {
  const head = to.head;
  head.replaceChildren();
  const meta = to.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  const base = to.createElement('base');
  base.href = from.baseURI;
  head.append(meta, base);
  for (const node of Array.from(from.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel~="stylesheet"], style'))) {
    if (node instanceof HTMLLinkElement) {
      const link = to.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href;
      head.append(link);
    } else {
      const style = to.createElement('style');
      style.textContent = node.textContent;
      head.append(style);
    }
  }
}
