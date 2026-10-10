import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { Switch } from '../../../shared/switch/switch';
import { PrintModel } from '../print-model';

/** Who stands in the middle of the page, with which partner. */
@Component({
  selector: 'stemma-centre-options',
  imports: [Switch],
  templateUrl: './centre-options.html',
  styleUrl: './centre-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'studio-group', role: 'group', 'aria-labelledby': 'print-g-middle' },
})
export class CentreOptions {
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;

  protected setCenter(event: Event): void {
    this.model.set({ centerId: (event.target as HTMLSelectElement).value, partnerId: undefined });
  }

  protected setPartner(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.model.set({ partnerId: id ? id : null });
  }
}
