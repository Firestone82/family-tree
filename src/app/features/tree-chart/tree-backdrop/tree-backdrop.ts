import { ChangeDetectionStrategy, Component, computed, inject, input, untracked } from '@angular/core';
import { LayoutResult } from '../../../core/layout/layout-types';
import { treeShape } from '../../../core/layout/tree-shape';
import { TreeStore } from '../../../core/store/tree-store';

/**
 * A tree drawn behind the chart: its trunk behind the couple the tree is
 * centred on, limbs up through their ancestors into a crown of leaves, roots
 * down to their descendants. Colours come from the chart style (--t-tree-*).
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'g[stemmaTreeBackdrop]',
  templateUrl: './tree-backdrop.html',
  styleUrl: './tree-backdrop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tree-backdrop', 'aria-hidden': 'true', '[class.faded]': 'faded()' },
})
export class TreeBackdrop {
  private readonly store = inject(TreeStore);

  /** The layout the chart is settling on; the tree is drawn for it. */
  readonly layout = input.required<LayoutResult>();
  /** The couple (or person) in the middle. */
  readonly focusIds = input.required<readonly string[]>();
  /** Hidden while the chart moves to a new layout, then faded back in. */
  readonly faded = input(false);

  /** One path per colour, so even a big tree is a handful of elements. */
  protected readonly art = computed(() => {
    const layout = this.layout();
    const focus = this.focusIds();
    // The relationships only change together with the layout, so edits to names
    // and dates (which make a new index but keep the layout) do not redraw the tree.
    const index = untracked(() => this.store.index());
    const shape = treeShape(layout, index, focus, { leaves: layout.cards.length > 400 ? 0.6 : 1 });
    if (!shape) return null;
    const f = shape.foliage;
    return {
      twigs: shape.twigs.join(''),
      shade: f.shade.join(''),
      body: f.body.join(''),
      light: f.light.join(''),
      wood: shape.wood.join(''),
      bark: shape.bark.join(''),
      leaves: f.leaves.map((l) => l.join('')),
    };
  });
}
