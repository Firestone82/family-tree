import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LayoutResult } from '../../../core/layout/layout-types';
import { pictureBox } from '../../../core/layout/picture';
import { BackgroundImage } from '../../../core/model/types';

/**
 * The person's own picture behind the chart, in place of the drawn tree. It
 * covers the area of the chart with a margin around it, so it follows the tree
 * as it grows; SVG pictures stay sharp at any zoom.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'g[stemmaBackdropPicture]',
  templateUrl: './backdrop-picture.html',
  styleUrl: './backdrop-picture.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'backdrop-picture', 'aria-hidden': 'true', '[class.faded]': 'faded()' },
})
export class BackdropPicture {
  readonly layout = input.required<LayoutResult>();
  readonly picture = input.required<BackgroundImage>();
  /** Hidden while the chart moves to a new layout, then faded back in. */
  readonly faded = input(false);

  protected readonly area = computed(() => {
    const layout = this.layout();
    const b = layout.bounds;
    const card = layout.cards[0];
    const mx = (card?.w ?? 160) * 0.6;
    const my = (card?.h ?? 80) * 1.2;
    return { x: b.x - mx, y: b.y - my, w: b.w + mx * 2, h: b.h + my * 2 };
  });

  protected readonly box = computed(() => pictureBox(this.area(), this.picture()));
}
