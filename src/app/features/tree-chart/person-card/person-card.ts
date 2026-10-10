import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Tincture } from '../../../core/colors/tinctures';
import { LayoutCard } from '../../../core/layout/layout-types';
import { sexSymbolPath } from '../../../core/layout/symbols';
import { CardMetrics, shieldPath } from '../../../state/card-metrics';
import { CardLabel } from '../../../state/chart-model';

/** One person on the chart, drawn as SVG inside the chart's <svg>. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'g[stemmaCard]',
  templateUrl: './person-card.html',
  styleUrl: './person-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'card',
    role: 'button',
    tabindex: '0',
    '[attr.transform]': 'transform()',
    '[attr.data-person]': 'card().personId',
    '[attr.data-tincture]': 'tincture()',
    '[attr.data-sex]': 'label().sex',
    '[attr.aria-label]': 'label().title',
    '[attr.aria-pressed]': 'selected()',
    '[class.deceased]': 'label().deceased',
    '[class.focus]': 'focus()',
    '[class.tinted]': 'sexColors()',
    '(click)': 'pick.emit($event)',
    '(keydown.enter)': 'pick.emit($event)',
    '(keydown.space)': 'onSpace($event)',
  },
})
export class PersonCard {
  readonly card = input.required<LayoutCard>();
  readonly label = input.required<CardLabel>();
  readonly tincture = input.required<Tincture>();
  readonly metrics = input.required<CardMetrics>();
  readonly selected = input(false);
  /** The person the tree is centred on. */
  readonly focus = input(false);
  /** Whether cards have a relationship line (all cards keep the same layout). */
  readonly kinRow = input(false);
  /** ♂ or ♀ in the top right corner. */
  readonly showSex = input(false);
  /** Blue-grey cards for men, rose for women. */
  readonly sexColors = input(false);
  readonly pick = output<Event>();

  protected readonly shift = computed(() => (this.kinRow() ? this.metrics().kin.shift : 0));
  protected readonly transform = computed(() => {
    const c = this.card();
    return `translate(${round(c.x)},${round(c.y)})`;
  });
  protected readonly shield = computed(() => shieldPath(this.metrics().shield.w, this.metrics().shield.h));
  protected readonly shieldTransform = computed(() => {
    const m = this.metrics();
    return `translate(${m.shield.x},${round((this.card().h - m.shield.h) / 2)})`;
  });
  protected readonly badgeX = computed(() => this.metrics().shield.x + this.metrics().shield.w / 2);
  protected readonly clipId = computed(() => `photo-${this.card().personId}`);
  protected readonly sexSymbol = computed(() => (this.showSex() ? sexSymbolPath(this.label().sex, 11) : ''));
  protected readonly symbolTransform = computed(() => `translate(${round(this.card().w - 12)},12)`);
  protected readonly focusTransform = computed(() => `translate(${round(this.card().w - 13)},${round(this.card().h - 13)})`);

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.pick.emit(event);
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
