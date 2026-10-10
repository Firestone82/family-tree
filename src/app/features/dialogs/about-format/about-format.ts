import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CURRENT_FORMAT, formatVersionString } from '../../../core/xml/format';
import { I18n } from '../../../i18n/i18n';
import { MessageKey } from '../../../i18n/locales';

const POINTS: readonly MessageKey[] = ['dialog.about.older', 'dialog.about.newer', 'dialog.about.major', 'dialog.about.extensions'];

/** How trees are saved, and why files keep working between versions. */
@Component({
  selector: 'stemma-about-format',
  templateUrl: './about-format.html',
  styleUrl: './about-format.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutFormat {
  protected readonly t = inject(I18n).t;
  protected readonly version = formatVersionString(CURRENT_FORMAT);
  protected readonly points = POINTS;

  readonly done = output<void>();
}
