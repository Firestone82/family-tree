import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrintSettings, Reach } from '../../../core/model/types';
import { I18n } from '../../../i18n/i18n';
import { MessageKey } from '../../../i18n/locales';
import { Icon } from '../../../shared/icon/icon';
import { SegmentOption, Segmented } from '../../../shared/segmented/segmented';
import { PrintModel } from '../print-model';

const BRANCH_HINT: Record<string, MessageKey> = {
  '0': 'print.branchHint.direct',
  '1': 'print.branchHint.siblings',
  '2': 'print.branchHint.cousins',
  all: 'print.branchHint.everyone',
};

type Direction = 'ancestors' | 'descendants';

/** How many generations up and down, and how far out to the sides of the family. */
@Component({
  selector: 'stemma-reach-options',
  imports: [Icon, Segmented],
  templateUrl: './reach-options.html',
  styleUrl: './reach-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'studio-group', role: 'group', 'aria-labelledby': 'print-g-far' },
})
export class ReachOptions {
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;

  protected readonly branches = computed<SegmentOption<Reach>[]>(() => [
    { value: 0, label: this.t('print.branch.direct') },
    { value: 1, label: this.t('print.branch.siblings') },
    { value: 2, label: this.t('print.branch.cousins') },
    { value: 'all', label: this.t('print.branch.everyone') },
  ]);

  /** "All" covers any number beyond cousins too. */
  protected readonly branchValue = computed<Reach>(() => {
    const b = this.model.settings().branches;
    return typeof b === 'number' && b > 2 ? 'all' : b;
  });
  protected readonly branchHint = computed(() => this.t(BRANCH_HINT[String(this.branchValue())] ?? BRANCH_HINT['all']));

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
