import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast, ToastService } from '../../core/services/toast';
import { I18n } from '../../i18n/i18n';
import { Icon } from '../../shared/icon/icon';

/** Short messages at the bottom of the screen, some with an action such as Undo. */
@Component({
  selector: 'stemma-toasts',
  imports: [Icon],
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
  protected readonly t = inject(I18n).t;

  protected run(toast: Toast): void {
    toast.action?.run();
    this.toasts.dismiss(toast.id);
  }
}
