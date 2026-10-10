import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { DocumentActions } from '../../../state/document-actions';

/** "Start a new tree?", with the offer to save the current one first. */
@Component({
  selector: 'stemma-confirm-new',
  imports: [Icon],
  templateUrl: './confirm-new.html',
  styleUrl: './confirm-new.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmNew {
  protected readonly documents = inject(DocumentActions);
  protected readonly t = inject(I18n).t;

  readonly done = output<void>();

  protected async saveFirst(): Promise<void> {
    this.done.emit();
    await this.documents.saveXml();
  }
}
