import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { kinLabel } from '../../../../core/lang/language';
import { initials } from '../../../../core/model/names';
import { Person } from '../../../../core/model/types';
import { TreeStore } from '../../../../core/store/tree-store';
import { I18n } from '../../../../i18n/i18n';
import { Icon } from '../../../../shared/icon/icon';
import { ChartModel } from '../../../../state/chart-model';

/** The person's portrait or shield, name, dates, and how they are related to the person in the middle. */
@Component({
  selector: 'stemma-person-header',
  imports: [Icon],
  templateUrl: './person-header.html',
  styleUrl: './person-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-head' },
})
export class PersonHeader {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly person = input.required<Person>();
  readonly closePanel = output<void>();

  protected readonly name = computed(() => this.i18n.name(this.person()));
  protected readonly initials = computed(() => initials(this.person()));
  protected readonly tincture = computed(() => this.model.colors().byPerson.get(this.person().id) ?? 'argent');
  protected readonly isFocus = computed(() => this.model.focusId() === this.person().id);
  protected readonly given = computed(() => this.person().name.given || this.t('person.thisPerson'));

  /** "née Moreau, 1930 – 2016" */
  protected readonly subline = computed(() => {
    const p = this.person();
    const birth = this.model.birthSurnames().get(p.id);
    const nee = birth && birth !== p.name.surname.trim() ? this.t(p.sex === 'male' ? 'person.neeMale' : 'person.nee', { name: birth }) : '';
    return [nee, this.i18n.lifespan(p)].filter(Boolean).join(', ');
  });

  /** How this person is related to the person the tree is centred on, in the chart's language. */
  protected readonly kin = computed(() =>
    kinLabel(this.model.language(), this.model.kin().get(this.person().id), this.person().sex, this.model.focusBornWith().get(this.person().id)),
  );
  protected readonly kinLang = computed(() => this.model.language().code);
  protected readonly focusName = computed(() => this.i18n.name(this.store.index().person(this.model.focusId())));
}
