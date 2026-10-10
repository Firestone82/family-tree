import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Notice } from '../../../core/model/notice';
import { I18n } from '../../../i18n/i18n';
import { DocumentActions } from '../../../state/document-actions';

/** A file from a future major version: open it anyway, or not. */
@Component({
  selector: 'stemma-newer-version',
  templateUrl: './newer-version.html',
  styleUrl: './newer-version.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewerVersion {
  private readonly documents = inject(DocumentActions);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly notice = input.required<Notice>();
  readonly xml = input.required<string>();
  readonly name = input('');
  readonly done = output<void>();

  protected readonly message = computed(() => this.i18n.notice(this.notice(), 'file.error.'));

  protected openAnyway(): void {
    this.documents.openXml(this.xml(), this.name(), true);
  }
}
