import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LayoutResult } from '../../../core/layout/layout-types';
import { I18n } from '../../../i18n/i18n';

/** Small dashed circles for parents nobody has entered yet; siblings hang from them. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'g[stemmaPlaceholders]',
  templateUrl: './placeholders.html',
  styleUrl: './placeholders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Placeholders {
  protected readonly t = inject(I18n).t;

  readonly layout = input.required<LayoutResult>();
  /** A placeholder was clicked (its family id). */
  readonly pick = output<string>();

  protected onPick(familyId: string, event: Event): void {
    event.stopPropagation();
    this.pick.emit(familyId);
  }
}
