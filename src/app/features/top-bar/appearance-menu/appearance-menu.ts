import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { updateView } from '../../../core/model/operations';
import { ViewSettings } from '../../../core/model/types';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { ChartModel } from '../../../state/chart-model';
import { UiState } from '../../../state/ui-state';
import { DisplayOptions } from './display-options/display-options';
import { LanguageOptions } from './language-options/language-options';
import { LookOptions } from './look-options/look-options';

/**
 * How the app and the chart look, and the language. Light or dark and the
 * language are kept in this browser; the lines and what the cards show are
 * saved in the tree's file.
 */
@Component({
  selector: 'stemma-appearance-menu',
  imports: [Icon, LookOptions, LanguageOptions, DisplayOptions],
  templateUrl: './appearance-menu.html',
  styleUrl: './appearance-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'menu-anchor' },
})
export class AppearanceMenu {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  protected readonly ui = inject(UiState);
  protected readonly t = inject(I18n).t;

  /** Only the icon on the button (narrow screens). */
  readonly iconOnly = input(false);

  protected readonly open = computed(() => this.ui.menu() === 'appearance');
  protected readonly view = this.model.view;

  protected set(patch: Partial<ViewSettings>): void {
    this.store.update((doc) => updateView(doc, patch));
  }
}
