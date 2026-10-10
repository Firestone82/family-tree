import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { PrintModel } from '../print-model';

/** Print, or save the page as PDF, PNG or SVG. */
@Component({
  selector: 'stemma-output-actions',
  imports: [Icon],
  templateUrl: './output-actions.html',
  styleUrl: './output-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutputActions {
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;
}
