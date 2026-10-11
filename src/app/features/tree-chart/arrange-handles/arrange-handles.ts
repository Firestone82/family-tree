import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LayoutResult } from '../../../core/layout/layout-types';
import { arrangementOf } from '../../../core/model/arrangement';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { ICONS } from '../../../shared/icon/icons';
import { coupleSwitches, lineGrips, movedBlocks } from '../arrange';

/**
 * What can be grabbed while arranging the chart by hand: a grip on each
 * family's line (drag it up or down), a button between partners that turns the
 * couple round, and a "put back" button on whatever was moved. Cards are
 * dragged themselves; the chart does the dragging (see tree-chart and arrange.ts).
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg>, so an attribute selector
  selector: 'g[stemmaArrangeHandles]',
  templateUrl: './arrange-handles.html',
  styleUrl: './arrange-handles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArrangeHandles {
  private readonly store = inject(TreeStore);
  protected readonly t = inject(I18n).t;
  protected readonly icons = ICONS;

  readonly layout = input.required<LayoutResult>();
  /** The family whose line is being dragged; its grip follows the line. */
  readonly dragging = input<string | null>(null);
  readonly turn = output<{ familyId: string; personId: string }>();
  readonly putBack = output<readonly string[]>();
  readonly putBackLine = output<string>();

  private readonly arrangement = computed(() => arrangementOf(this.store.doc()));
  protected readonly grips = computed(() => lineGrips(this.layout(), this.arrangement()));
  protected readonly switches = computed(() => coupleSwitches(this.layout(), this.store.index()));
  protected readonly moved = computed(() => movedBlocks(this.layout(), this.store.index(), this.arrangement()));

  protected onTurn(familyId: string, personId: string, event: Event): void {
    event.stopPropagation();
    this.turn.emit({ familyId, personId });
  }

  protected onPutBack(members: readonly string[], event: Event): void {
    event.stopPropagation();
    this.putBack.emit(members);
  }

  protected onPutBackLine(familyId: string, event: Event): void {
    event.stopPropagation();
    this.putBackLine.emit(familyId);
  }

  /** Clicks on a grip are part of a drag, not a click on the chart. */
  protected swallow(event: Event): void {
    event.stopPropagation();
  }
}
