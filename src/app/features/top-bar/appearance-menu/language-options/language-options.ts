import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n } from '../../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';

/**
 * The language: one setting for the app (menus, panels, messages) and for
 * the words on the chart and in prints (relationship names, notes about
 * couples, dates). It is kept in this browser.
 */
@Component({
  selector: 'stemma-language-options',
  imports: [Segmented],
  templateUrl: './language-options.html',
  styleUrl: './language-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageOptions {
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  protected readonly options: SegmentOption<string>[] = this.i18n.locales.map((l) => ({ value: l.code, label: l.name, lang: l.code }));
}
