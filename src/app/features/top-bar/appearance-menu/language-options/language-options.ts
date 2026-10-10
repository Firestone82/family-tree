import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LANGUAGES } from '../../../../core/lang/language';
import { I18n } from '../../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';

/**
 * Two languages: the app's (menus, panels, messages) and the chart's
 * (relationship names, marriages and dates on the chart and in prints).
 */
@Component({
  selector: 'stemma-language-options',
  imports: [Segmented],
  templateUrl: './language-options.html',
  styleUrl: './language-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageOptions {
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly appLanguage = input.required<string>();
  readonly chartLanguage = input.required<string>();
  readonly appLanguageChange = output<string>();
  readonly chartLanguageChange = output<string>();

  protected readonly appOptions: SegmentOption<string>[] = this.i18n.locales.map((l) => ({ value: l.code, label: l.name, lang: l.code }));
  protected readonly chartOptions: SegmentOption<string>[] = LANGUAGES.map((l) => ({ value: l.code, label: l.name, lang: l.code }));
  protected readonly chartValue = computed(() => this.chartOptions.find((o) => this.chartLanguage().startsWith(o.value))?.value ?? 'en');
}
