import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LineStyle, ViewSettings } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';
import { THEME_CHOICES, Theme, ThemeChoice } from '../../../../state/theme';

/** Light or dark (a setting of this browser), and the chart's lines (saved with the tree). */
@Component({
  selector: 'stemma-look-options',
  imports: [Segmented],
  templateUrl: './look-options.html',
  styleUrl: './look-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LookOptions {
  protected readonly t = inject(I18n).t;
  protected readonly theme = inject(Theme);

  readonly view = input.required<ViewSettings>();
  readonly settingsChange = output<Partial<ViewSettings>>();

  protected readonly styles = computed<SegmentOption<ThemeChoice>[]>(() => THEME_CHOICES.map((value) => ({ value, label: this.t(`look.style.${value}`) })));

  protected readonly lines = computed<SegmentOption<LineStyle>[]>(() => [
    { value: 'square', label: this.t('look.lines.square') },
    { value: 'curved', label: this.t('look.lines.curved') },
  ]);
}
