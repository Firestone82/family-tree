import { Injectable, inject, signal } from '@angular/core';
import { BACKGROUND_ACCEPT, BackgroundError, backgroundFromFile } from '../core/services/background-import';
import { FileIo } from '../core/services/file-io';
import { ToastService } from '../core/services/toast';
import { TreeStore } from '../core/store/tree-store';
import { BackgroundImage, TreeDocument } from '../core/model/types';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/locales';

/** The picture behind the chart: choosing one, how it is placed, and going back to the drawn tree. */
@Injectable({ providedIn: 'root' })
export class BackgroundActions {
  private readonly store = inject(TreeStore);
  private readonly files = inject(FileIo);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  /** A picture is being read (a large PDF can take a few seconds). */
  readonly busy = signal(false);

  async choose(): Promise<void> {
    const file = await this.files.pick(BACKGROUND_ACCEPT);
    if (!file) return;
    this.busy.set(true);
    try {
      const picture = await backgroundFromFile(file);
      const before = this.store.doc().background;
      this.store.update((doc) => ({
        ...doc,
        // A new picture keeps how the last one was placed, and is shown.
        background: before ? { ...picture, fit: before.fit, opacity: before.opacity } : picture,
        view: { ...doc.view, showTree: true },
      }));
      this.toast.show(this.i18n.t('background.set'));
    } catch (e) {
      const code = e instanceof BackgroundError ? e.code : 'unsupported';
      this.toast.error(this.i18n.t(`background.error.${code}` as MessageKey));
    } finally {
      this.busy.set(false);
    }
  }

  /** How the picture fills the area, and how strong it is. Moving the slider is one undo step. */
  set(patch: Partial<Pick<BackgroundImage, 'fit' | 'opacity'>>): void {
    this.store.update((doc) => (doc.background ? { ...doc, background: { ...doc.background, ...patch } } : doc), `background:${Object.keys(patch).join()}`);
  }

  /** Back to the drawn tree. */
  remove(): void {
    if (!this.store.doc().background) return;
    this.store.update(({ background: _removed, ...doc }): TreeDocument => doc);
    this.toast.show(this.i18n.t('background.removed'), { action: { label: this.i18n.t('common.undo'), run: () => this.store.undo() } });
  }
}
