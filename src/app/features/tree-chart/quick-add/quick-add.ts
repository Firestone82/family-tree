import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { Relation } from '../../../state/ui-state';

/** Buttons floating over the selected card: centre the tree here, add a relative. */
@Component({
  selector: 'stemma-quick-add',
  imports: [Icon],
  templateUrl: './quick-add.html',
  styleUrl: './quick-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    '[class.below]': 'below()',
    '[style.left.px]': 'left()',
    '[style.top.px]': 'top()',
    '[attr.aria-label]': "t('quickAdd.label', { name: name() })",
  },
})
export class QuickAdd {
  protected readonly t = inject(I18n).t;

  readonly left = input.required<number>();
  readonly top = input.required<number>();
  /** Shown under the card instead of above it (near the top of the screen). */
  readonly below = input(false);
  readonly name = input('');
  /** The person already has both parents. */
  readonly parentsFull = input(false);
  /** The tree is already centred on this person. */
  readonly isFocus = input(false);
  readonly add = output<Relation>();
  readonly centre = output<void>();
}
