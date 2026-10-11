import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { isArranged } from '../../../core/model/arrangement';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { ArrangeActions } from '../../../state/arrange-actions';
import { UiState } from '../../../state/ui-state';

/** Shown over the chart while arranging it by hand: what can be done, putting everything back, and Done. */
@Component({
  selector: 'stemma-arrange-bar',
  imports: [Icon],
  templateUrl: './arrange-bar.html',
  styleUrl: './arrange-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'toolbar', '[attr.aria-label]': "t('arrange.title')" },
})
export class ArrangeBar {
  private readonly store = inject(TreeStore);
  protected readonly ui = inject(UiState);
  protected readonly arrange = inject(ArrangeActions);
  protected readonly t = inject(I18n).t;

  protected readonly arranged = computed(() => isArranged(this.store.doc()));
}
