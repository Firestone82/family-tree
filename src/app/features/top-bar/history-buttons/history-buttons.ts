import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { PersonActions } from '../../../state/person-actions';

/** Undo and redo. */
@Component({
  selector: 'stemma-history-buttons',
  imports: [Icon],
  templateUrl: './history-buttons.html',
  styleUrl: './history-buttons.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryButtons {
  protected readonly store = inject(TreeStore);
  protected readonly people = inject(PersonActions);
  protected readonly t = inject(I18n).t;
}
