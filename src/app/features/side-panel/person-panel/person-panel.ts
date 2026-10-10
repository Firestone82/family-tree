import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Person } from '../../../core/model/types';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { ChartModel } from '../../../state/chart-model';
import { PersonActions } from '../../../state/person-actions';
import { Relation } from '../../../state/ui-state';
import { PersonFamily } from './person-family/person-family';
import { PersonHeader } from './person-header/person-header';
import { PersonLifeForm } from './person-life-form/person-life-form';
import { PersonNameForm } from './person-name-form/person-name-form';
import { PersonSummary } from './person-summary/person-summary';

/** One person: who they are, their details, their family, and what can be done with them. */
@Component({
  selector: 'stemma-person-panel',
  imports: [Icon, PersonHeader, PersonSummary, PersonNameForm, PersonLifeForm, PersonFamily],
  templateUrl: './person-panel.html',
  styleUrl: './person-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonPanel {
  private readonly model = inject(ChartModel);
  protected readonly people = inject(PersonActions);
  protected readonly t = inject(I18n).t;

  readonly person = input.required<Person>();

  protected readonly isFocus = computed(() => this.model.focusId() === this.person().id);

  protected add(relation: Relation): void {
    this.people.startAdd(relation, this.person().id);
  }
}
