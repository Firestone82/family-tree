import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';

/** Zoom out, the zoom level, zoom in, and show everything. */
@Component({
  selector: 'stemma-zoom-controls',
  imports: [Icon],
  templateUrl: './zoom-controls.html',
  styleUrl: './zoom-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': "t('zoom.label')" },
})
export class ZoomControls {
  protected readonly t = inject(I18n).t;

  readonly percent = input.required<number>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fit = output<void>();
}
