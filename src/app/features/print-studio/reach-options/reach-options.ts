import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrintSettings, Reach } from '../../../core/model/types';
import { Relatives, relativesOf, relativesSettings } from '../../../core/poster/scope';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { RelativesOptions } from '../../../shared/relatives-options/relatives-options';
import { PrintModel } from '../print-model';

type Direction = 'ancestors' | 'descendants';

/** How many generations up and down, and how far out to the sides of the family. */
@Component({
  selector: 'stemma-reach-options',
  imports: [Icon, RelativesOptions],
  templateUrl: './reach-options.html',
  styleUrl: './reach-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'studio-group', role: 'group', 'aria-labelledby': 'print-g-far' },
})
export class ReachOptions {
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;

  protected readonly relatives = computed(() => relativesOf(this.model.settings()));

  protected readonly steppers = computed(() => {
    const s = this.model.settings();
    const depth = this.model.depth();
    return (['ancestors', 'descendants'] as const).map((key) => {
      const max = key === 'ancestors' ? depth.up : depth.down;
      const value = reachValue(s[key], max);
      return {
        key,
        id: `print-${key}`,
        label: this.t(key === 'ancestors' ? 'print.up' : 'print.down'),
        fewer: this.t(key === 'ancestors' ? 'print.fewerUp' : 'print.fewerDown'),
        more: this.t(key === 'ancestors' ? 'print.moreUp' : 'print.moreDown'),
        text: value > max ? this.t('print.all') : value === 0 ? this.t('print.none') : String(value),
        atMin: value === 0,
        atMax: s[key] === 'all',
      };
    });
  });

  protected setRelatives(r: Relatives): void {
    this.model.set(relativesSettings(r));
  }

  protected step(key: Direction, delta: number): void {
    const max = key === 'ancestors' ? this.model.depth().up : this.model.depth().down;
    const next = Math.max(0, Math.min(max + 1, reachValue(this.model.settings()[key], max) + delta));
    this.model.set({ [key]: next > max ? 'all' : next } as Partial<PrintSettings>);
  }
}

/** A reach as a number of generations; "all" is one more than there are. */
function reachValue(r: Reach, max: number): number {
  return r === 'all' ? max + 1 : Math.min(r, max + 1);
}
