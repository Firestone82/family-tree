import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, untracked } from '@angular/core';
import { birthFather } from '../../../../core/model/surnames';
import { PersonName, Person, Sex } from '../../../../core/model/types';
import { TreeStore } from '../../../../core/store/tree-store';
import { I18n } from '../../../../i18n/i18n';
import { ChartModel } from '../../../../state/chart-model';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';
import { PersonActions } from '../../../../state/person-actions';
import { UiState } from '../../../../state/ui-state';

type NameField = 'given' | 'surname' | 'birthSurname';

/** Given names, surnames and sex. */
@Component({
  selector: 'stemma-person-name-form',
  imports: [Segmented],
  templateUrl: './person-name-form.html',
  styleUrl: './person-name-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class PersonNameForm {
  private readonly people = inject(PersonActions);
  private readonly ui = inject(UiState);
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly t = inject(I18n).t;

  readonly person = input.required<Person>();

  /** Unless written in, the surname at birth is the father's: "Nováková (from the father)". */
  protected readonly birthSurnameHint = computed(() => {
    const p = this.person();
    if (!birthFather(this.store.index(), p.id)) return this.t('name.birthSurnamePlaceholder');
    const name = this.model.birthSurnames().get(p.id);
    return name ? this.t('name.birthSurnameFromFather', { name }) : this.t('name.birthSurnamePlaceholder');
  });

  protected readonly sexes = computed<SegmentOption<Sex>[]>(() => [
    { value: 'female', label: this.t('sex.female') },
    { value: 'male', label: this.t('sex.male') },
    { value: 'other', label: this.t('sex.other') },
    { value: 'unknown', label: this.t('sex.unknown') },
  ]);

  constructor() {
    // Focus the name field when asked (after adding a person).
    effect(() => {
      const field = this.ui.focusField();
      this.person();
      if (!field) return;
      untracked(() =>
        setTimeout(() => {
          const el = this.host.nativeElement.querySelector<HTMLInputElement>(`#person-${field}`);
          el?.focus();
          el?.select();
          this.ui.focusField.set(null);
        }, 30),
      );
    });
  }

  protected setName(field: NameField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const optional = field === 'birthSurname';
    this.people.update(this.person().id, { name: { [field]: optional && !value.trim() ? undefined : value } as Partial<PersonName> }, field);
  }

  /** Stray spaces are removed when the person leaves the field. */
  protected trimName(field: NameField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value === value.trim()) return;
    const trimmed = value.trim() || (field === 'given' || field === 'surname' ? '' : undefined);
    this.people.update(this.person().id, { name: { [field]: trimmed } as Partial<PersonName> }, field);
  }

  protected setSex(sex: Sex): void {
    this.people.update(this.person().id, { sex }, 'sex');
  }
}
