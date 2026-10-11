import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18n } from '../../../../i18n/i18n';
import { ChartModel } from '../../../../state/chart-model';

/** What the colours of the name shields mean: one colour per family name. */
@Component({
  selector: 'stemma-colour-legend',
  templateUrl: './colour-legend.html',
  styleUrl: './colour-legend.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColourLegend {
  private readonly model = inject(ChartModel);
  protected readonly t = inject(I18n).t;

  /** Legend entries: family names, and a word of the app for the names that appear only once. */
  protected readonly entries = computed(() =>
    this.model.colors().legend.map((l) => ({ key: l.key, tincture: l.tincture, label: l.key === '' ? this.t('legend.others') : l.label, count: l.count })),
  );
}
