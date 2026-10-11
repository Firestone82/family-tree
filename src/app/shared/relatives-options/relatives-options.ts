import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RELATIVES, Relatives } from '../../core/poster/scope';
import { I18n } from '../../i18n/i18n';

/**
 * The steps of the Relatives setting as a list to choose from: the direct
 * line out to everyone, each with what it adds and, when known, how many
 * people it shows. Used by the chart and by the print studio.
 */
@Component({
  selector: 'stemma-relatives-options',
  templateUrl: './relatives-options.html',
  styleUrl: './relatives-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'radiogroup', '[attr.aria-labelledby]': 'labelledBy()' },
})
export class RelativesOptions {
  private readonly i18n = inject(I18n);

  readonly value = input.required<Relatives>();
  /** Name of the radio group, unique on the page. */
  readonly name = input.required<string>();
  readonly labelledBy = input<string>();
  /** How many people each step shows, when known. */
  readonly counts = input<Readonly<Record<Relatives, number>> | null>(null);
  /** What each step adds: under every step, or only under the chosen one (where room is short). */
  readonly hints = input<'all' | 'chosen'>('all');
  readonly valueChange = output<Relatives>();

  protected readonly options = computed(() =>
    RELATIVES.map((value) => ({
      value,
      label: this.i18n.t(`relatives.${value}`),
      hint: this.i18n.t(`relatives.hint.${value}`),
      count: this.counts()?.[value],
      title: this.counts() ? this.i18n.t('relatives.count', { count: this.counts()![value] }) : undefined,
    })),
  );
}
