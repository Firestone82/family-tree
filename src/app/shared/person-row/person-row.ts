import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * A person in a list: their family colour, name and dates. Put it on a button:
 * <button type="button" stemmaPersonRow [name]="…" (click)="…">.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'button[stemmaPersonRow]',
  imports: [Icon],
  templateUrl: './person-row.html',
  styleUrl: './person-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonRow {
  readonly name = input.required<string>();
  readonly dates = input('');
  readonly tincture = input('argent');
  /** A short label after the name, such as "adopted". */
  readonly tag = input('');
  /** An icon instead of the family colour. */
  readonly icon = input<string>();
  /** A number in front, for children in birth order. */
  readonly ordinal = input<number>();
}
