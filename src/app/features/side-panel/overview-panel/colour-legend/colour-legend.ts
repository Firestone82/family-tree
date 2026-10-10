import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Sex } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { ChartModel } from '../../../../state/chart-model';

/** What the colours of the name shields mean. */
@Component({
  selector: 'stemma-colour-legend',
  templateUrl: './colour-legend.html',
  styleUrl: './colour-legend.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColourLegend {
  private readonly model = inject(ChartModel);
  protected readonly t = inject(I18n).t;

  protected readonly colorBy = computed(() => this.model.view().colorBy);

  protected readonly title = computed(() => {
    switch (this.colorBy()) {
      case 'family':
        return this.t('legend.familyTitle');
      case 'generation':
        return this.t('legend.generationTitle');
      case 'sex':
        return this.t('legend.sexTitle');
      default:
        return '';
    }
  });

  /** Legend entries; the colour-by-sex labels are words of the app, the rest are names or numbers. */
  protected readonly entries = computed(() =>
    this.model.colors().legend.map((l) => {
      let label = l.label;
      if (l.key === '') label = this.t('legend.others');
      else if (this.colorBy() === 'sex') label = this.t(`legend.sex.${l.key as Sex}`);
      else if (this.colorBy() === 'generation') label = this.t('legend.generationN', { n: l.label });
      return { key: l.key, tincture: l.tincture, label, count: l.count };
    }),
  );
}
