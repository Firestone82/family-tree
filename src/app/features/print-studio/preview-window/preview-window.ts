import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { FileIo } from '../../../core/services/file-io';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Theme } from '../../../state/theme';
import { UiState } from '../../../state/ui-state';
import { PrintModel } from '../print-model';
import { PreviewPage, PreviewWords } from './preview-page';

/** Width of the print studio at the side of the screen while the page has a window of its own (see print-studio.scss). */
export const DOCKED_WIDTH = 440;

/** How often the window is looked at: whether it was closed, and where it was moved. */
const WATCH_MS = 500;

/** The Document Picture-in-Picture API (Chrome and Edge 116+, Firefox 151+): a window that stays in front. */
interface DocumentPip {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  readonly window: Window | null;
}

/**
 * The print preview in a window of its own, as large as one likes, while the
 * settings stay in the print studio, which keeps to one side of the screen.
 *
 * Where the browser has it, the window is a picture-in-picture window, which
 * stays in front of the app while the settings are changed. The browser puts
 * it where it was last, or at first in the bottom right corner, and a page
 * cannot move it; so the studio keeps to the side of the screen away from it:
 * on the left at first, and on the right once the window is moved to the left.
 * Elsewhere it is an ordinary pop-up window, opened to the left of the studio.
 * The page in it follows every change of the settings; it closes with the studio.
 */
@Injectable({ providedIn: 'root' })
export class PreviewWindow {
  private readonly model = inject(PrintModel);
  private readonly store = inject(TreeStore);
  private readonly ui = inject(UiState);
  private readonly i18n = inject(I18n);
  private readonly theme = inject(Theme);
  private readonly files = inject(FileIo);

  /** The page is in its own window. */
  readonly isOpen = signal(false);
  /** The side of the screen the studio keeps to while the page is in its own window: away from that window. */
  readonly side = signal<'left' | 'right'>('right');
  /** The browser did not open the window (pop-ups blocked). */
  readonly failed = signal(false);
  /** Offered in a browser of its own on a big enough screen; the artifact viewer does not allow other windows. */
  readonly available = computed(() => !this.files.hosted && !this.ui.narrow());

  private win: Window | null = null;
  private page: PreviewPage | null = null;
  private opening = false;
  private watch: ReturnType<typeof setInterval> | undefined;
  private readonly onLeave = () => this.close();

  constructor() {
    effect(() => {
      const poster = this.model.poster();
      if (this.isOpen()) untracked(() => this.page?.showPage(poster));
    });
    effect(() => {
      const words = this.words();
      this.theme.choice();
      if (this.isOpen()) untracked(() => this.page?.showWords(words, themeOf(document)));
    });
    // The window goes when the studio closes.
    effect(() => {
      if (!this.ui.printOpen()) {
        untracked(() => {
          this.close();
          this.failed.set(false);
        });
      }
    });
  }

  private readonly words = computed<PreviewWords>(() => {
    const t = this.i18n.t;
    const title = this.model.settings().title?.trim() || this.store.doc().meta.title;
    return {
      title: t('print.window.title', { title }),
      summary: this.model.summary(),
      note: this.model.sizeNote(),
      preparing: t('print.preparing'),
      zoomIn: t('zoom.in'),
      zoomOut: t('zoom.out'),
      fit: t('print.window.fit'),
      actual: t('print.window.actual'),
      lang: this.i18n.code(),
    };
  });

  /** Opens the window, or brings it to the front. Called from a click: browsers open windows only then. */
  async open(): Promise<void> {
    if (this.win && !this.win.closed) {
      this.win.focus();
      return;
    }
    if (this.opening) return;
    this.opening = true;
    this.failed.set(false);
    let win: Window | null;
    try {
      win = await this.openWindow();
    } finally {
      this.opening = false;
    }
    if (!win) {
      this.failed.set(true);
      return;
    }
    // The studio may have been closed while the browser was opening the window.
    if (!this.ui.printOpen()) {
      win.close();
      return;
    }
    let page: PreviewPage;
    try {
      page = new PreviewPage(win);
      page.showWords(this.words(), themeOf(document));
      page.showPage(this.model.poster());
    } catch {
      win.close();
      this.failed.set(true);
      return;
    }
    this.win = win;
    this.page = page;
    this.place(win);
    win.addEventListener('pagehide', () => this.closed(win));
    // A pop-up closed with its own button does not always say so, and a moved window does not say so at all.
    this.watch = setInterval(() => (win.closed ? this.closed(win) : this.place(win)), WATCH_MS);
    window.addEventListener('pagehide', this.onLeave);
    this.isOpen.set(true);
  }

  /** Closes the window; the page is back in the studio. */
  close(): void {
    const win = this.win;
    if (win && !win.closed) win.close();
    if (win) this.closed(win);
  }

  private closed(win: Window): void {
    if (this.win !== win) return;
    this.win = null;
    this.page = null;
    clearInterval(this.watch);
    window.removeEventListener('pagehide', this.onLeave);
    this.isOpen.set(false);
  }

  /** Keeps the studio on the side of the app away from the window; on the right when the window is elsewhere (another screen). */
  private place(win: Window): void {
    if (!win.outerWidth) return;
    const app = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight };
    const over = win.screenX < app.x + app.w && win.screenX + win.outerWidth > app.x && win.screenY < app.y + app.h && win.screenY + win.outerHeight > app.y;
    this.side.set(over && win.screenX + win.outerWidth / 2 > app.x + app.w / 2 ? 'left' : 'right');
  }

  private async openWindow(): Promise<Window | null> {
    const pip = (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
    const poster = this.model.poster();
    const ratio = poster ? poster.width / poster.height : 1.414;
    // As big as the page needs beside the studio; the browser keeps a picture-in-picture window within its own limits.
    const room = { w: screen.availWidth - DOCKED_WIDTH - 24, h: screen.availHeight - 40 };
    const height = Math.round(Math.min(room.h, room.w / ratio + 90));
    const width = Math.round(Math.min(room.w, (height - 90) * ratio + 60));
    if (pip?.requestWindow) {
      try {
        return pip.window ?? (await pip.requestWindow({ width: Math.max(480, width), height: Math.max(360, height) }));
      } catch {
        // Not allowed here (an embedded page, say): an ordinary window instead.
      }
    }
    const left = Math.round(window.screenX + 8);
    const top = Math.round(window.screenY + 8);
    const w = Math.max(480, Math.min(width, window.outerWidth - DOCKED_WIDTH - 24));
    const h = Math.max(360, Math.min(height, window.outerHeight - 90));
    return window.open('', 'stemma-print-preview', `popup,left=${left},top=${top},width=${w},height=${h}`);
  }
}

/** The light or dark choice on a page (state/theme.ts), for the window to follow. */
function themeOf(doc: Document): string | null {
  return doc.documentElement.getAttribute('data-theme');
}
