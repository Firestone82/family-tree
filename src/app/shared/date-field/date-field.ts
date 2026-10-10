import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { parseDateInput } from '../../core/model/dates';
import { GenDate } from '../../core/model/types';
import { I18n } from '../../i18n/i18n';

/**
 * A date box that accepts the many ways people write dates ("17.5.1923",
 * "May 1923", "17. května 1923", "abt 1900", "before 1850") and says how it read them.
 */
@Component({
  selector: 'stemma-date-field',
  templateUrl: './date-field.html',
  styleUrl: './date-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateField {
  private readonly i18n = inject(I18n);

  readonly value = input<GenDate | undefined>();
  readonly inputId = input.required<string>();
  readonly placeholder = input<string>();
  readonly valueChange = output<GenDate | undefined>();

  protected readonly t = this.i18n.t;
  protected readonly focused = signal(false);
  protected readonly text = signal('');
  private readonly typed = signal(false);

  /** How the typed text was understood, while typing. */
  protected readonly hint = computed<{ text: string; warn: boolean } | null>(() => {
    if (!this.typed()) return null;
    const raw = this.text().trim();
    const parsed = raw ? parseDateInput(raw) : undefined;
    if (!parsed) return null;
    if (!parsed.value) return { text: this.t('date.keptAsText'), warn: true };
    const formatted = this.i18n.dates().fullDate(parsed);
    return formatted.toLowerCase() === raw.toLowerCase() ? null : { text: this.t('date.readAs', { date: formatted }), warn: false };
  });

  constructor() {
    // Show the stored date in the app's language, except while the person is typing.
    effect(() => {
      const shown = this.i18n.dates().fullDate(this.value());
      if (!untracked(this.focused)) this.text.set(shown);
    });
  }

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.text.set(raw);
    this.typed.set(true);
    this.valueChange.emit(parseDateInput(raw));
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.typed.set(false);
    this.text.set(this.i18n.dates().fullDate(this.value()));
  }
}
