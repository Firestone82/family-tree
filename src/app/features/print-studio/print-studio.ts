import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, untracked, viewChild } from '@angular/core';
import { I18n } from '../../i18n/i18n';
import { Icon } from '../../shared/icon/icon';
import { UiState } from '../../state/ui-state';
import { CardOptions } from './card-options/card-options';
import { CentreOptions } from './centre-options/centre-options';
import { OutputActions } from './output-actions/output-actions';
import { PaperOptions } from './paper-options/paper-options';
import { PrintModel } from './print-model';
import { PrintPreview } from './print-preview/print-preview';
import { ReachOptions } from './reach-options/reach-options';
import { StylePicker } from './style-picker/style-picker';

/**
 * Print and export: the page on the left, and on the right the print style,
 * who is in the middle, how far the tree reaches, what the cards show and the paper.
 */
@Component({
  selector: 'stemma-print-studio',
  imports: [Icon, PrintPreview, StylePicker, CentreOptions, ReachOptions, CardOptions, PaperOptions, OutputActions],
  templateUrl: './print-studio.html',
  styleUrl: './print-studio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintStudio {
  private readonly ui = inject(UiState);
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const open = this.ui.printOpen();
      const el = this.dialog().nativeElement;
      if (open && !el.open) {
        el.showModal();
        untracked(() => this.model.loadFonts());
      } else if (!open && el.open) {
        el.close();
      }
    });
  }

  /** Escape closes the native dialog; keep the state in step. */
  protected onClosed(): void {
    if (this.ui.printOpen()) this.model.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.model.close();
  }
}
