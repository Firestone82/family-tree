import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { updateView } from '../../../core/model/operations';
import { Relatives, relativesOf, relativesSettings } from '../../../core/poster/scope';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { RelativesOptions } from '../../../shared/relatives-options/relatives-options';
import { ChartModel } from '../../../state/chart-model';
import { UiState } from '../../../state/ui-state';

/**
 * Who the chart shows, next to the zoom buttons: the direct line out to the
 * whole tree. The button says how many people are left out; the choice is
 * saved with the tree and is where prints start from.
 */
@Component({
  selector: 'stemma-relatives-filter',
  imports: [Icon, RelativesOptions],
  templateUrl: './relatives-filter.html',
  styleUrl: './relatives-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'menu-anchor' },
})
export class RelativesFilter {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  protected readonly ui = inject(UiState);
  protected readonly t = inject(I18n).t;

  protected readonly open = computed(() => this.ui.menu() === 'relatives');
  protected readonly value = computed(() => relativesOf(this.model.view()));
  protected readonly label = computed(() => this.t(`relatives.${this.value()}`));
  protected readonly total = computed(() => this.store.doc().people.length);
  protected readonly shown = computed(() => this.total() - this.model.hidden().size);
  /** Only worked out while the list is open. */
  protected readonly counts = computed(() => (this.open() ? this.model.relativesCounts() : null));

  protected choose(r: Relatives): void {
    this.store.update((doc) => updateView(doc, relativesSettings(r)));
  }
}
