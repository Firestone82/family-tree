import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Orientation } from '../../../core/model/types';
import { FIT_PAPER, PAPERS } from '../../../core/poster/paper';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../shared/segmented/segmented';
import { PrintModel } from '../print-model';

/** The paper size and orientation, and the title on the page. */
@Component({
  selector: 'stemma-paper-options',
  imports: [Segmented],
  templateUrl: './paper-options.html',
  styleUrl: './paper-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'studio-group', role: 'group', 'aria-labelledby': 'print-g-paper' },
})
export class PaperOptions {
  private readonly store = inject(TreeStore);
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;

  protected readonly papers = PAPERS;
  protected readonly fitPaper = FIT_PAPER;
  protected readonly treeTitle = computed(() => this.store.doc().meta.title);
  protected readonly fit = computed(() => this.model.settings().paper === FIT_PAPER);

  protected readonly orientations = computed<SegmentOption<Orientation>[]>(() => [
    { value: 'auto', label: this.t('print.orientation.auto') },
    { value: 'portrait', label: this.t('print.orientation.portrait') },
    { value: 'landscape', label: this.t('print.orientation.landscape') },
  ]);

  protected isPaper(id: string): boolean {
    return this.model.settings().paper.toLowerCase() === id.toLowerCase();
  }

  protected setPaper(event: Event): void {
    this.model.set({ paper: (event.target as HTMLSelectElement).value });
  }

  protected setText(key: 'title' | 'subtitle', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.model.set({ [key]: value.trim() ? value : undefined });
  }
}
