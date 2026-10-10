import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { updateView } from '../../../core/model/operations';
import { ViewSettings } from '../../../core/model/types';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { BackgroundPicker } from '../../../shared/background-picker/background-picker';
import { Icon } from '../../../shared/icon/icon';
import { ChartModel } from '../../../state/chart-model';
import { UiState } from '../../../state/ui-state';
import { DisplayOptions } from './display-options/display-options';
import { LanguageOptions } from './language-options/language-options';
import { LookOptions } from './look-options/look-options';

/**
 * How the chart looks, and the language of the app. The chart settings are
 * saved in the tree's file; the app language is kept in this browser.
 */
@Component({
  selector: 'stemma-appearance-menu',
  imports: [Icon, LookOptions, LanguageOptions, DisplayOptions, BackgroundPicker],
  templateUrl: './appearance-menu.html',
  styleUrl: './appearance-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'menu-anchor' },
})
export class AppearanceMenu {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  protected readonly ui = inject(UiState);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  /** Only the icon on the button (narrow screens). */
  readonly iconOnly = input(false);

  protected readonly open = computed(() => this.ui.menu() === 'appearance');
  protected readonly view = this.model.view;
  protected readonly chartLanguage = computed(() => this.model.language().code);

  protected set(patch: Partial<ViewSettings>): void {
    this.store.update((doc) => updateView(doc, patch));
  }
}
