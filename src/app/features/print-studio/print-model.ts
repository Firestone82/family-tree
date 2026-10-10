import { Injectable, computed, inject, signal } from '@angular/core';
import { bloodRelatives } from '../../core/kinship/kinship';
import { displayName, sortName } from '../../core/model/names';
import { updatePrint, updateView } from '../../core/model/operations';
import { relationshipStatus } from '../../core/model/relationship';
import { DEFAULT_PRINT, PrintSettings, effectivePrint } from '../../core/model/types';
import { PAPERS, PX_PER_MM } from '../../core/poster/paper';
import { pdfFromJpeg } from '../../core/poster/pdf';
import { PosterResult, renderPoster } from '../../core/poster/poster';
import { POSTER_THEMES } from '../../core/poster/themes';
import { FileIo, safeFilename } from '../../core/services/file-io';
import { ImageExporter } from '../../core/services/image-export';
import { TextMeasurer } from '../../core/services/text-measure';
import { ToastService } from '../../core/services/toast';
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { STATUS_LABEL } from '../../i18n/labels';
import { UiState } from '../../state/ui-state';

export type PrintOutput = 'print' | 'pdf' | 'png' | 'svg';

/** Resolution for PNG and PDF files of paper sizes. */
const PRINT_DPI = 200;

/**
 * The print studio's state and work: the page drawn from the print settings,
 * the choices offered, and making the files. Settings are saved with the tree.
 */
@Injectable({ providedIn: 'root' })
export class PrintModel {
  private readonly store = inject(TreeStore);
  private readonly ui = inject(UiState);
  private readonly measure = inject(TextMeasurer);
  private readonly exporter = inject(ImageExporter);
  private readonly files = inject(FileIo);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  /** The browser print dialog is not available inside the artifact viewer. */
  readonly canPrint = !this.files.hosted;
  readonly fontsReady = signal(false);
  readonly busy = signal<PrintOutput | null>(null);

  readonly settings = computed<PrintSettings>(() => ({ ...DEFAULT_PRINT, ...effectivePrint(this.store.doc()) }));
  readonly chartLanguage = computed(() => this.store.doc().view.language);

  /** The page, drawn only while the studio is open and the fonts can be measured. */
  readonly poster = computed<PosterResult | null>(() => {
    if (!this.ui.printOpen() || !this.fontsReady()) return null;
    this.measure.fontsVersion();
    const doc = this.store.doc();
    if (!doc.people.length) return null;
    return renderPoster({ doc, settings: this.settings(), measure: (t, f) => this.measure.width(t, f) });
  });

  readonly themeId = computed(() => this.poster()?.theme.id ?? this.settings().theme);

  /** Everyone, for choosing who goes in the middle. */
  readonly people = computed(() =>
    this.store
      .doc()
      .people.map((p) => ({ id: p.id, name: sortName(p) }))
      .sort((a, b) => this.i18n.compare(a.name, b.name)),
  );

  readonly centerId = computed(() => this.poster()?.centerId ?? this.store.doc().meta.homePersonId ?? '');

  readonly partners = computed(() => {
    const index = this.store.index();
    const id = this.centerId();
    return index
      .partnerFamilies(id)
      .filter((f) => f.partners.length === 2)
      .map((f) => {
        const other = f.partners.find((p) => p !== id)!;
        const status = this.i18n.t(STATUS_LABEL[relationshipStatus(f)]).toLocaleLowerCase(this.i18n.locale().intl);
        return { id: other, label: `${displayName(index.person(other))} (${status})` };
      });
  });

  readonly partnerChoice = computed(() => (this.settings().partnerId === null ? '' : (this.poster()?.partnerId ?? '')));

  /** How many generations there are above and below the couple in the whole tree. */
  readonly depth = computed(() => {
    const index = this.store.index();
    const roots = [this.centerId(), this.poster()?.partnerId].filter((x): x is string => !!x);
    let up = 0;
    let down = 0;
    for (const r of roots) {
      for (const [, info] of bloodRelatives(index, r)) {
        if (info.down === 0) up = Math.max(up, info.up);
        if (info.up === 0) down = Math.max(down, info.down);
      }
    }
    return { up, down };
  });

  /** "A3 landscape, 420 × 297 mm. 29 people." */
  readonly summary = computed(() => {
    const p = this.poster();
    if (!p) return '';
    const t = this.i18n.t;
    const size = p.paper
      ? t('print.size.paper', {
          paper: this.paperLabel(),
          orientation: t(p.paper.landscape ? 'print.orientation.landscape' : 'print.orientation.portrait').toLocaleLowerCase(this.i18n.locale().intl),
          w: Math.round(p.paper.widthMm),
          h: Math.round(p.paper.heightMm),
        })
      : t('print.size.px', { w: Math.round(p.width), h: Math.round(p.height) });
    const people = p.people === p.total ? t('print.people.all', { count: p.people }) : t('print.people.some', { shown: p.people, total: p.total });
    return `${size}. ${people}.`;
  });

  /** How big the names come out on paper, with a warning when they are too small to read. */
  readonly sizeNote = computed(() => {
    const p = this.poster();
    if (!p?.paper) return null;
    const pt = Math.round(p.namePt * 10) / 10;
    return pt < 6 ? { warn: true, text: this.i18n.t('print.nameSizeSmall', { pt }) } : { warn: false, text: this.i18n.t('print.nameSize', { pt }) };
  });

  paperLabel(): string {
    const id = this.settings().paper;
    return PAPERS.find((p) => p.id.toLowerCase() === id.toLowerCase())?.label ?? 'A3';
  }

  set(patch: Partial<PrintSettings>): void {
    this.store.update((doc) => updatePrint(doc, patch), 'print');
  }

  /** The words on the chart are a setting of the tree, shared with the screen. */
  setChartLanguage(code: string): void {
    this.store.update((doc) => updateView(doc, { language: code }));
  }

  /** Waits for the fonts of all print styles, so text is measured with the real letters. */
  async loadFonts(): Promise<void> {
    if (this.fontsReady()) return;
    const faces = new Set(POSTER_THEMES.flatMap((t) => t.fonts));
    try {
      await Promise.all([...faces].map((f) => document.fonts?.load(f)));
    } catch {
      // Fallback fonts are measured instead.
    }
    this.fontsReady.set(true);
  }

  close(): void {
    this.ui.printOpen.set(false);
  }

  async output(kind: PrintOutput): Promise<void> {
    const p = this.poster();
    if (!p || this.busy()) return;
    if (kind === 'print') {
      printPage(p);
      return;
    }
    this.busy.set(kind);
    try {
      const base = this.settings().title?.trim() || this.store.doc().meta.title;
      const svg = await this.exporter.withEmbeddedFonts(p.svg, p.text);
      if (kind === 'svg') {
        await this.save(safeFilename(base, 'svg'), new Blob([svg], { type: 'image/svg+xml' }), 'image/svg+xml');
        return;
      }
      const size = this.exporter.rasterSize(p.width, p.height, p.paper ? PRINT_DPI : 192);
      const canvas = await this.exporter.rasterize(svg, size.w, size.h, p.theme.palette.paper);
      if (kind === 'png') {
        await this.save(safeFilename(base, 'png'), await this.exporter.toBlob(canvas, 'image/png'), 'image/png');
      } else {
        const jpeg = new Uint8Array(await (await this.exporter.toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
        const pt = 72 / 96;
        await this.save(safeFilename(base, 'pdf'), pdfFromJpeg(jpeg, size.w, size.h, p.width * pt, p.height * pt, base), 'application/pdf');
      }
    } catch {
      this.toast.error(this.i18n.t('print.failed'));
    } finally {
      this.busy.set(null);
    }
  }

  private async save(filename: string, data: Blob, mime: string): Promise<void> {
    const outcome = await this.files.save(filename, data, mime);
    if (outcome === 'saved') this.toast.show(this.i18n.t('file.saved', { name: filename }));
    else if (outcome === 'unsupported') this.toast.error(this.i18n.t('print.unsupported'));
    else if (outcome === 'failed') this.toast.error(this.i18n.t('file.saveFailed'));
  }
}

/** Prints through the browser: only the page is printed, at its paper size. */
function printPage(p: PosterResult): void {
  const w = p.paper ? p.paper.widthMm : p.width / PX_PER_MM;
  const h = p.paper ? p.paper.heightMm : p.height / PX_PER_MM;
  const style = document.createElement('style');
  style.textContent =
    `@page { size: ${w.toFixed(1)}mm ${h.toFixed(1)}mm; margin: 0; }` +
    `.stemma-print { display: none; }` +
    `@media print { html, body { height: auto !important; overflow: visible !important; background: none !important; }` +
    ` body > *:not(.stemma-print) { display: none !important; }` +
    ` .stemma-print { display: block !important; } .stemma-print svg { display: block; width: ${w.toFixed(1)}mm; height: ${h.toFixed(1)}mm; } }`;
  const holder = document.createElement('div');
  holder.className = 'stemma-print';
  holder.innerHTML = p.svg;
  document.head.append(style);
  document.body.append(holder);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    style.remove();
    holder.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 60_000);
}
