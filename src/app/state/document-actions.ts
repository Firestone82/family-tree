import { Injectable, inject } from '@angular/core';
import { updateMeta } from '../core/model/operations';
import { sampleDocument } from '../core/model/sample';
import { emptyDocument } from '../core/model/types';
import { Autosave } from './autosave';
import { FileIo, safeFilename } from '../core/services/file-io';
import { ToastService } from '../core/services/toast';
import { TreeStore } from '../core/store/tree-store';
import { XmlFormatError, parseTree } from '../core/xml/parser';
import { serializeTree } from '../core/xml/serializer';
import { I18n } from '../i18n/i18n';
import { Preferences } from './preferences';
import { UiState } from './ui-state';

/** Whole trees: starting, opening, saving, the example family and the print studio. */
@Injectable({ providedIn: 'root' })
export class DocumentActions {
  private readonly store = inject(TreeStore);
  private readonly ui = inject(UiState);
  private readonly files = inject(FileIo);
  private readonly toast = inject(ToastService);
  private readonly autosave = inject(Autosave);
  private readonly prefs = inject(Preferences);
  private readonly i18n = inject(I18n);

  /** Reopens the tree from the last visit, or shows the example family the first time. */
  restore(): void {
    const saved = this.autosave.read();
    if (saved instanceof Promise) {
      // A big tree kept in IndexedDB: the chart waits for it rather than flashing the empty state.
      this.ui.restoring.set(true);
      void saved.then((xml) => this.reopen(xml)).finally(() => this.ui.restoring.set(false));
      return;
    }
    this.reopen(saved);
  }

  private reopen(saved: string | null): void {
    if (saved) {
      try {
        this.store.load(parseTree(saved).doc);
        this.autosave.enable();
        return;
      } catch {
        // A damaged copy should not block the app; fall back to the example.
      }
    }
    this.store.load(sampleDocument());
    this.ui.showSampleNote.set(!this.prefs.read().sampleNoteDismissed);
    this.autosave.enable();
  }

  newTree(): void {
    this.ui.closeMenu();
    if (!this.store.doc().people.length) {
      this.startEmpty();
      return;
    }
    this.ui.dialog.set({ kind: 'confirm-new' });
  }

  /** An empty tree whose chart speaks the app's language. */
  startEmpty(): void {
    const doc = emptyDocument(this.i18n.t('tree.newTitle'));
    this.store.load({ ...doc, view: { ...doc.view, language: this.i18n.code() } });
    this.ui.adding.set(null);
    this.ui.showSampleNote.set(false);
    this.ui.dialog.set(null);
  }

  loadSample(): void {
    this.ui.closeMenu();
    this.store.load(sampleDocument());
    this.ui.showSampleNote.set(true);
    this.toast.show(this.i18n.t('file.sampleOpened'));
  }

  dismissSampleNote(): void {
    this.ui.showSampleNote.set(false);
    this.prefs.set({ sampleNoteDismissed: true });
  }

  async openFile(): Promise<void> {
    this.ui.closeMenu();
    const file = await this.files.pick('.xml,application/xml,text/xml');
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      this.toast.error(this.i18n.t('file.unreadable'));
      return;
    }
    this.openXml(text, file.name);
  }

  openXml(xml: string, name?: string, force = false): void {
    const fileName = name ?? this.i18n.t('file.theFile');
    try {
      const result = parseTree(xml, { force });
      this.store.load(result.doc);
      this.ui.showSampleNote.set(false);
      this.ui.dialog.set(null);
      if (result.warnings.length || result.upgrades.length) {
        this.ui.dialog.set({ kind: 'import-report', title: result.doc.meta.title, notes: result.warnings, upgrades: result.upgrades });
      } else {
        this.toast.show(this.i18n.t('file.opened', { title: result.doc.meta.title }));
      }
    } catch (e) {
      if (e instanceof XmlFormatError && e.code === 'newer-major') {
        this.ui.dialog.set({ kind: 'newer-version', notice: e, xml, name: fileName });
      } else if (e instanceof XmlFormatError) {
        this.toast.error(`${this.i18n.t('file.openFailed', { name: fileName })} ${this.i18n.notice(e, 'file.error.')}`);
      } else {
        this.toast.error(this.i18n.t('file.openFailed', { name: fileName }));
      }
    }
  }

  xml(): string {
    return serializeTree(this.store.doc());
  }

  /** Saves through a download, or shows the XML to copy where downloads of .xml are not allowed. */
  async saveXml(): Promise<void> {
    this.ui.closeMenu();
    const xml = this.xml();
    const filename = safeFilename(this.store.doc().meta.title, 'xml');
    if (!this.files.canSave(filename)) {
      this.ui.dialog.set({ kind: 'xml', xml, filename });
      return;
    }
    const outcome = await this.files.save(filename, xml, 'application/xml');
    if (outcome === 'saved') this.toast.show(this.i18n.t('file.saved', { name: filename }));
    else if (outcome === 'unsupported') this.ui.dialog.set({ kind: 'xml', xml, filename });
    else if (outcome === 'failed') this.toast.error(this.i18n.t('file.saveFailed'));
  }

  async saveXmlAsText(xml: string, filename: string): Promise<void> {
    const name = filename.replace(/\.xml$/i, '') + '.xml.txt';
    const outcome = await this.files.save(name, xml, 'text/plain');
    if (outcome === 'saved') this.toast.show(this.i18n.t('file.savedAsText', { name }));
    else if (outcome !== 'declined') this.toast.error(this.i18n.t('file.saveUnavailable'));
  }

  /** True when an .xml download can be offered directly. */
  canSaveXml(): boolean {
    return this.files.canSave('tree.xml');
  }

  openPrint(): void {
    this.ui.closeMenu();
    if (!this.store.doc().people.length) {
      this.toast.show(this.i18n.t('print.needPeople'));
      return;
    }
    this.ui.printOpen.set(true);
  }

  showAbout(): void {
    this.ui.closeMenu();
    this.ui.dialog.set({ kind: 'about' });
  }

  /** Renames the tree; typing is merged into one undo step. */
  setTitle(title: string): void {
    this.store.update((doc) => updateMeta(doc, { title }), 'meta:title');
  }

  /** Tidies the name when the person leaves the field: no stray spaces, never empty. */
  finishTitle(title: string): void {
    const clean = title.trim() || this.i18n.t('tree.newTitle');
    if (clean !== this.store.doc().meta.title) this.store.update((doc) => updateMeta(doc, { title: clean }), 'meta:title');
  }

  setDescription(text: string): void {
    this.store.update((doc) => updateMeta(doc, { description: text.trim() ? text : undefined }), 'meta:description');
  }

  /** Keeps the copy in this browser up to date before the page goes away. */
  flush(): void {
    this.autosave.flush();
  }
}
