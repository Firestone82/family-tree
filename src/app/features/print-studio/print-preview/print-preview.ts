import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { I18n } from '../../../i18n/i18n';

/**
 * The page as it will print, on a light table. The SVG is placed in the page
 * itself, so it uses the fonts the app has already loaded.
 */
@Component({
  selector: 'stemma-print-preview',
  templateUrl: './print-preview.html',
  styleUrl: './print-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-label]': "t('print.preview')" },
})
export class PrintPreview {
  protected readonly t = inject(I18n).t;

  /** The page as SVG markup, or null while it is being prepared. */
  readonly svg = input<string | null>(null);
  readonly width = input(0);
  readonly height = input(0);
  readonly summary = input('');
  readonly note = input<{ warn: boolean; text: string } | null>(null);

  private readonly sheet = viewChild<ElementRef<HTMLDivElement>>('sheet');
  /** Width divided by height of the page, for sizing the sheet. */
  protected readonly ratio = computed(() => (this.width() && this.height() ? this.width() / this.height() : 1.414));

  constructor() {
    effect(() => {
      const svg = this.svg();
      const host = this.sheet()?.nativeElement;
      if (host) host.innerHTML = svg ?? '';
    });
  }
}
