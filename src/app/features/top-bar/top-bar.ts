import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { Icon } from '../../shared/icon/icon';
import { DocumentActions } from '../../state/document-actions';
import { UiState } from '../../state/ui-state';
import { AppearanceMenu } from './appearance-menu/appearance-menu';
import { FileMenu } from './file-menu/file-menu';
import { HistoryButtons } from './history-buttons/history-buttons';

/** The bar across the top: the app and tree name, undo and redo, print, appearance and the file menu. */
@Component({
  selector: 'stemma-top-bar',
  imports: [Icon, HistoryButtons, AppearanceMenu, FileMenu],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  private readonly store = inject(TreeStore);
  protected readonly ui = inject(UiState);
  protected readonly documents = inject(DocumentActions);
  protected readonly t = inject(I18n).t;

  protected readonly title = computed(() => this.store.doc().meta.title || this.t('tree.untitled'));
}
