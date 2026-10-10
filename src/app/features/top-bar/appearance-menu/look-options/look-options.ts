import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ColorBy, Density, LineStyle, TreeStyle, ViewSettings } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';

/** The chart's style, what colours the name shields, the lines and the spacing. */
@Component({
  selector: 'stemma-look-options',
  imports: [Segmented],
  templateUrl: './look-options.html',
  styleUrl: './look-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LookOptions {
  protected readonly t = inject(I18n).t;

  readonly view = input.required<ViewSettings>();
  readonly settingsChange = output<Partial<ViewSettings>>();

  protected readonly styles = computed<SegmentOption<TreeStyle>[]>(() => [
    { value: 'auto', label: this.t('look.style.auto') },
    { value: 'archive', label: this.t('look.style.archive') },
    { value: 'print', label: this.t('look.style.print') },
    { value: 'night', label: this.t('look.style.night') },
  ]);

  protected readonly styleHint = computed(() => {
    switch (this.view().style) {
      case 'auto':
        return this.t('look.style.autoHint');
      case 'archive':
        return this.t('look.style.archiveHint');
      case 'print':
        return this.t('look.style.printHint');
      case 'night':
        return this.t('look.style.nightHint');
    }
  });

  protected readonly colors = computed<SegmentOption<ColorBy>[]>(() => [
    { value: 'family', label: this.t('look.colour.family') },
    { value: 'generation', label: this.t('look.colour.generation') },
    { value: 'sex', label: this.t('look.colour.sex') },
    { value: 'none', label: this.t('look.colour.none') },
  ]);

  protected readonly lines = computed<SegmentOption<LineStyle>[]>(() => [
    { value: 'square', label: this.t('look.lines.square') },
    { value: 'curved', label: this.t('look.lines.curved') },
  ]);

  protected readonly densities = computed<SegmentOption<Density>[]>(() => [
    { value: 'comfortable', label: this.t('look.spacing.comfortable') },
    { value: 'compact', label: this.t('look.spacing.compact') },
  ]);
}
