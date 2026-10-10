import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n } from '../../i18n/i18n';
import { Icon } from '../../shared/icon/icon';
import { DocumentActions } from '../../state/document-actions';
import { PersonActions } from '../../state/person-actions';

/** What an empty tree shows: how to begin. */
@Component({
  selector: 'stemma-empty-state',
  imports: [Icon],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', 'aria-labelledby': 'empty-title' },
})
export class EmptyState {
  protected readonly documents = inject(DocumentActions);
  private readonly people = inject(PersonActions);
  protected readonly t = inject(I18n).t;

  protected addFirst(): void {
    this.people.addLoosePerson({ given: '' });
  }
}
