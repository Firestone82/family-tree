import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Notice } from '../../../core/model/notice';
import { I18n } from '../../../i18n/i18n';

/** What happened while opening a file: upgrades from older versions and repairs. */
@Component({
  selector: 'stemma-import-report',
  templateUrl: './import-report.html',
  styleUrl: './import-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportReport {
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly title = input.required<string>();
  readonly notes = input<readonly Notice[]>([]);
  readonly upgrades = input<readonly Notice[]>([]);
  readonly done = output<void>();

  protected readonly noteLines = computed(() => this.notes().map((n) => this.i18n.notice(n, 'notice.')));
  protected readonly upgradeLines = computed(() => this.upgrades().map((n) => this.i18n.notice(n, 'notice.')));
}
