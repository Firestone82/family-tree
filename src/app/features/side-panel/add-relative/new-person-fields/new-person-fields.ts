import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { GenDate, Sex } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { DateField } from '../../../../shared/date-field/date-field';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';

/**
 * The few details asked for a new person: names (or that nobody knows the
 * given name), sex, birth, and whether they have died.
 */
@Component({
  selector: 'stemma-new-person-fields',
  imports: [DateField, Segmented],
  templateUrl: './new-person-fields.html',
  styleUrl: './new-person-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPersonFields {
  protected readonly t = inject(I18n).t;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly given = input('');
  /** Nobody knows the given name: the field is off and the chart says "Unknown". */
  readonly unknown = input(false);
  readonly surname = input('');
  readonly sex = input<Sex>('unknown');
  readonly birth = input<GenDate | undefined>();
  readonly deceased = input(false);
  readonly givenChange = output<string>();
  readonly unknownChange = output<boolean>();
  readonly surnameChange = output<string>();
  readonly sexChange = output<Sex>();
  readonly birthChange = output<GenDate | undefined>();
  readonly deceasedChange = output<boolean>();

  protected readonly sexes = computed<SegmentOption<Sex>[]>(() => [
    { value: 'female', label: this.t('sex.female') },
    { value: 'male', label: this.t('sex.male') },
    { value: 'other', label: this.t('sex.other') },
    { value: 'unknown', label: this.t('sex.unknown') },
  ]);

  protected setUnknown(unknown: boolean): void {
    this.unknownChange.emit(unknown);
    // Back to typing the name.
    if (!unknown) setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('#add-given')?.focus(), 0);
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
