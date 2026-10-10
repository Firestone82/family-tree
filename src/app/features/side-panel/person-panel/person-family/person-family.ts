import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Person } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { CoupleList } from './couple-list/couple-list';
import { ParentGroups } from './parent-groups/parent-groups';
import { SiblingList } from './sibling-list/sibling-list';

/** Parents, partners with their children, and siblings, each one click away. */
@Component({
  selector: 'stemma-person-family',
  imports: [ParentGroups, CoupleList, SiblingList],
  templateUrl: './person-family.html',
  styleUrl: './person-family.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class PersonFamily {
  protected readonly t = inject(I18n).t;

  readonly person = input.required<Person>();
}
