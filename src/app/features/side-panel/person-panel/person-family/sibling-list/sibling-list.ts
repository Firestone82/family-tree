import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { birthGroupOf } from '../../../../../core/model/births';
import { Person } from '../../../../../core/model/types';
import { TreeStore } from '../../../../../core/store/tree-store';
import { I18n } from '../../../../../i18n/i18n';
import { bornTogetherTag } from '../../../../../i18n/labels';
import { Icon } from '../../../../../shared/icon/icon';
import { PersonRow } from '../../../../../shared/person-row/person-row';
import { PersonActions } from '../../../../../state/person-actions';
import { PersonRows } from '../person-rows';

/** Brothers and sisters, then half-siblings who share only one parent. */
@Component({
  selector: 'stemma-sibling-list',
  imports: [Icon, PersonRow],
  templateUrl: './sibling-list.html',
  styleUrl: './sibling-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiblingList {
  private readonly store = inject(TreeStore);
  private readonly rows = inject(PersonRows);
  protected readonly people = inject(PersonActions);
  protected readonly t = inject(I18n).t;

  readonly person = input.required<Person>();

  protected readonly siblings = computed(() => {
    const group = birthGroupOf(this.store.doc(), this.person().id);
    const tag = group ? bornTogetherTag(this.t, group.memberIds.length) : '';
    return this.store
      .index()
      .siblings(this.person().id)
      .map((p) => ({ ...this.rows.row(p), tag: group?.memberIds.includes(p.id) ? tag : '' }));
  });
  protected readonly halfSiblings = computed(() =>
    this.store
      .index()
      .halfSiblings(this.person().id)
      .map((p) => this.rows.row(p)),
  );
}
