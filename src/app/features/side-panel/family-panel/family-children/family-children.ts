import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { displayName } from '../../../../core/model/names';
import { ChildRelation, Family, Person } from '../../../../core/model/types';
import { TreeStore } from '../../../../core/store/tree-store';
import { I18n } from '../../../../i18n/i18n';
import { bornTogetherLabel } from '../../../../i18n/labels';
import { Icon } from '../../../../shared/icon/icon';
import { PersonRow } from '../../../../shared/person-row/person-row';
import { ChartModel } from '../../../../state/chart-model';
import { FamilyActions } from '../../../../state/family-actions';
import { PersonActions } from '../../../../state/person-actions';

/** A family's children in the order the chart draws them, with how each is related. */
@Component({
  selector: 'stemma-family-children',
  imports: [Icon, PersonRow],
  templateUrl: './family-children.html',
  styleUrl: './family-children.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class FamilyChildren {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly i18n = inject(I18n);
  protected readonly families = inject(FamilyActions);
  protected readonly people = inject(PersonActions);
  protected readonly t = this.i18n.t;

  readonly family = input.required<Family>();

  protected readonly relations = computed(() =>
    (['biological', 'adopted', 'foster', 'step', 'unknown'] as const).map((value) => ({ value, label: this.t(`childRelation.${value}`) })),
  );

  protected readonly children = computed(() => {
    const list = this.family()
      .children.map((c) => ({ person: this.store.index().person(c.personId), relation: c.relation, group: c.birthGroup }))
      .filter((c): c is { person: Person; relation: ChildRelation; group: string | undefined } => !!c.person);
    const size = (group: string | undefined) => (group ? list.filter((c) => c.group === group).length : 0);
    return list.map((c, i) => {
      const next = list[i + 1];
      const withNext = !!c.group && next?.group === c.group;
      return {
        id: c.person.id,
        name: displayName(c.person),
        dates: this.i18n.lifespan(c.person),
        tincture: this.model.colors().byPerson.get(c.person.id) ?? 'argent',
        relation: c.relation,
        nextId: next?.person.id,
        withNext,
        /** "Twins", "Triplets": shown on the link to the next child. */
        together: withNext ? bornTogetherLabel(this.t, size(c.group)) : '',
      };
    });
  });

  protected toggleBirth(childId: string, nextId: string | undefined, linked: boolean): void {
    const f = this.family();
    if (linked) this.families.splitBirth(f.id, childId);
    else if (nextId) this.families.linkBirth(f.id, [childId, nextId]);
  }

  protected setRelation(childId: string, event: Event): void {
    this.families.setChildRelation(this.family().id, childId, (event.target as HTMLSelectElement).value as ChildRelation);
  }
}
