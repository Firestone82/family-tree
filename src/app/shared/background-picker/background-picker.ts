import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BackgroundFit } from '../../core/model/types';
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { BackgroundActions } from '../../state/background-actions';
import { Icon } from '../icon/icon';
import { SegmentOption, Segmented } from '../segmented/segmented';

/** Pixels on the long side for a photo to print sharply on A2 or A1; smaller ones look soft there. */
const SHARP_FOR_POSTERS = 4000;

/**
 * Choosing a picture of one's own for behind the chart, instead of the drawn
 * tree: how it fills the area, how strong it is, and going back to the tree.
 * Used in the appearance menu and in the print studio.
 */
@Component({
  selector: 'stemma-background-picker',
  imports: [Icon, Segmented],
  templateUrl: './background-picker.html',
  styleUrl: './background-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundPicker {
  private readonly store = inject(TreeStore);
  protected readonly actions = inject(BackgroundActions);
  protected readonly t = inject(I18n).t;

  /** Prefix for the ids of the fields, so the picker can appear in two places. */
  readonly idPrefix = input('bg');

  protected readonly picture = computed(() => this.store.doc().background);
  protected readonly isVector = computed(() => this.picture()?.href.startsWith('data:image/svg+xml') ?? false);
  protected readonly size = computed(() => {
    const p = this.picture();
    if (!p) return '';
    return this.isVector() ? this.t('background.vector') : this.t('background.pixels', { w: Math.round(p.width), h: Math.round(p.height) });
  });
  protected readonly soft = computed(() => {
    const p = this.picture();
    return !!p && !this.isVector() && Math.max(p.width, p.height) < SHARP_FOR_POSTERS;
  });
  protected readonly percent = computed(() => Math.round((this.picture()?.opacity ?? 1) * 100));

  protected readonly fits = computed<SegmentOption<BackgroundFit>[]>(() => [
    { value: 'cover', label: this.t('background.fit.cover') },
    { value: 'contain', label: this.t('background.fit.contain') },
  ]);

  protected setOpacity(event: Event): void {
    this.actions.set({ opacity: Number((event.target as HTMLInputElement).value) / 100 });
  }
}
