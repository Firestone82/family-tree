import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { MessageKey } from '../../../i18n/locales';
import { Icon } from '../../../shared/icon/icon';
import { ChartModel } from '../../../state/chart-model';
import { DocumentActions } from '../../../state/document-actions';
import { PersonActions } from '../../../state/person-actions';
import { UiState } from '../../../state/ui-state';
import { ColourLegend } from './colour-legend/colour-legend';
import { PeopleList } from './people-list/people-list';

const TIPS: readonly MessageKey[] = [
  'overview.tip.select',
  'overview.tip.centre',
  'overview.tip.relatives',
  'overview.tip.arrange',
  'overview.tip.print',
  'overview.tip.move',
  'overview.tip.keys',
  'overview.tip.save',
];

/** The tree as a whole: its name and description, everyone in it, the colours, and tips. */
@Component({
  selector: 'stemma-overview-panel',
  imports: [Icon, PeopleList, ColourLegend],
  templateUrl: './overview-panel.html',
  styleUrl: './overview-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPanel {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly people = inject(PersonActions);
  protected readonly documents = inject(DocumentActions);
  protected readonly ui = inject(UiState);
  protected readonly t = inject(I18n).t;

  /** Shows a close button (the people sheet on phones). */
  readonly closable = input(false);

  protected readonly meta = computed(() => this.store.doc().meta);
  protected readonly tips = TIPS;

  protected readonly summary = computed(() => {
    const s = this.model.stats();
    if (!s.people) return this.t('overview.empty');
    const people = this.t('overview.people', { count: s.people });
    return s.generations > 1 ? this.t('overview.generations', { people, count: s.generations }) : people;
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected open(personId: string): void {
    this.ui.peopleOpen.set(false);
    this.people.select(personId);
  }

  protected add(): void {
    this.people.addLoosePerson();
  }
}
