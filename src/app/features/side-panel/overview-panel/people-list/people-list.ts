import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { normalizeQuery, searchText } from '../../../../core/model/names';
import { Person } from '../../../../core/model/types';
import { relativesOf } from '../../../../core/poster/scope';
import { TreeStore } from '../../../../core/store/tree-store';
import { I18n } from '../../../../i18n/i18n';
import { Icon } from '../../../../shared/icon/icon';
import { ChartModel } from '../../../../state/chart-model';
import { UiState } from '../../../../state/ui-state';
import { FamilyGroupItem, FamilyRow } from './family-group/family-group';
import { groupByFamily } from './family-groups';

/** Small trees start with every family open; bigger ones as a list of families. */
const OPEN_UP_TO = 15;

/**
 * Everyone in the tree, grouped by family name (Mikula and Mikulová together).
 * Each family opens and closes; searching opens the families with a match.
 */
@Component({
  selector: 'stemma-people-list',
  imports: [Icon, FamilyGroupItem],
  templateUrl: './people-list.html',
  styleUrl: './people-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleList {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly ui = inject(UiState);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly open = output<string>();
  readonly add = output<void>();

  protected readonly query = signal('');
  protected readonly searchable = computed(() => this.store.doc().people.length > 6);
  private readonly openByDefault = computed(() => this.store.doc().people.length <= OPEN_UP_TO);

  protected readonly families = computed(() => {
    const q = normalizeQuery(this.query());
    const colors = this.model.colors();
    const familyColors = new Map(colors.legend.map((e) => [e.key, e.tincture]));
    const chosen = this.ui.familyOpen();
    const hidden = this.model.hidden();
    const people = this.store.doc().people.filter((p) => !q || searchText(p).includes(q));
    const row = (p: Person): FamilyRow => ({
      id: p.id,
      name: this.i18n.sortName(p),
      dates: this.i18n.lifespan(p),
      tincture: colors.byPerson.get(p.id) ?? 'argent',
      offChart: hidden.has(p.id),
    });
    return groupByFamily(people, this.i18n.compare).map((g) => ({
      key: g.key,
      label: g.key ? g.spellings.slice(0, 3).join(' / ') : this.t('overview.noSurname'),
      tincture: familyColors.get(g.key) ?? 'argent',
      members: g.members.map(row),
      count: this.t('overview.people', { count: g.members.length }),
      open: !!q || (chosen.get(g.key) ?? this.openByDefault()),
    }));
  });

  protected readonly offChartHint = computed(() => this.t('relatives.hiddenNote', { level: this.t(`relatives.${relativesOf(this.model.view())}`) }));

  /** Whether the button offers to open every family (some are closed) or to close them. */
  protected readonly canOpenAll = computed(() => this.families().some((f) => !f.open));

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggle(key: string, open: boolean): void {
    this.ui.familyOpen.update((m) => new Map(m).set(key, !open));
  }

  protected setAll(open: boolean): void {
    this.ui.familyOpen.set(new Map(this.families().map((f) => [f.key, open])));
  }
}
