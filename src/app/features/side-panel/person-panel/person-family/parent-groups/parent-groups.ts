import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChildRelation, Person } from '../../../../../core/model/types';
import { TreeStore } from '../../../../../core/store/tree-store';
import { I18n } from '../../../../../i18n/i18n';
import { MessageKey } from '../../../../../i18n/locales';
import { Icon } from '../../../../../shared/icon/icon';
import { PersonRow } from '../../../../../shared/person-row/person-row';
import { PersonActions } from '../../../../../state/person-actions';
import { PersonRows } from '../person-rows';

const GROUP_LABEL: Record<ChildRelation, MessageKey> = {
  biological: 'parents.biological',
  adopted: 'parents.adopted',
  foster: 'parents.foster',
  step: 'parents.step',
  unknown: 'parents.unknown',
};

/** The person's parents, one group per family they are a child of (birth, adoptive, foster…). */
@Component({
  selector: 'stemma-parent-groups',
  imports: [Icon, PersonRow],
  templateUrl: './parent-groups.html',
  styleUrl: './parent-groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParentGroups {
  private readonly store = inject(TreeStore);
  private readonly rows = inject(PersonRows);
  protected readonly people = inject(PersonActions);
  protected readonly t = inject(I18n).t;

  readonly person = input.required<Person>();

  protected readonly groups = computed(() => {
    const index = this.store.index();
    const id = this.person().id;
    const primary = index.primaryParentFamily(id);
    return index.parentFamilies(id).map((f) => ({
      family: f,
      label: GROUP_LABEL[index.childRelation(f, id)],
      parents: f.partners
        .map((p) => index.person(p))
        .filter((p): p is Person => !!p)
        .map((p) => this.rows.row(p)),
      canAdd: f === primary && f.partners.length < 2,
    }));
  });
}
