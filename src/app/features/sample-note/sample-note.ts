import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n } from '../../i18n/i18n';
import { DocumentActions } from '../../state/document-actions';

/** A note over the example family: explore it, or start your own tree. */
@Component({
  selector: 'stemma-sample-note',
  templateUrl: './sample-note.html',
  styleUrl: './sample-note.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'note', '[attr.aria-label]': "t('sample.label')" },
})
export class SampleNote {
  private readonly documents = inject(DocumentActions);
  protected readonly t = inject(I18n).t;

  protected startOwn(): void {
    this.documents.dismissSampleNote();
    this.documents.startEmpty();
  }

  protected keepExploring(): void {
    this.documents.dismissSampleNote();
  }
}
