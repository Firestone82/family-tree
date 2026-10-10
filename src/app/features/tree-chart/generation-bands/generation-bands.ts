import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LayoutResult } from '../../../core/layout/layout-types';

/** Alternating stripes behind the generations, with their numbers on the left. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'g[stemmaBands]',
  templateUrl: './generation-bands.html',
  styleUrl: './generation-bands.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerationBands {
  readonly layout = input.required<LayoutResult>();

  protected readonly bands = computed(() => {
    const L = this.layout();
    const x = L.bounds.x - 72;
    const w = L.bounds.w + 144;
    return L.rows.map((r, i) => ({
      key: r.rank,
      y: r.y - 14,
      h: r.h + 28,
      x,
      w,
      label: r.label,
      labelX: L.bounds.x - 44,
      labelY: r.y + r.h / 2,
      odd: i % 2 === 1,
    }));
  });
}
