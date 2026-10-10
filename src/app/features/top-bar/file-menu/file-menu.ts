import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { DocumentActions } from '../../../state/document-actions';
import { UiState } from '../../../state/ui-state';

/** The File button and its menu: new, open, save, print, the example family, the file format. */
@Component({
  selector: 'stemma-file-menu',
  imports: [Icon],
  templateUrl: './file-menu.html',
  styleUrl: './file-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'menu-anchor' },
})
export class FileMenu {
  protected readonly ui = inject(UiState);
  protected readonly documents = inject(DocumentActions);
  protected readonly t = inject(I18n).t;

  protected readonly open = computed(() => this.ui.menu() === 'file');
  /** Where .xml cannot be downloaded, saving shows the XML to copy instead (hence the ellipsis). */
  protected readonly saveLabel = computed(() => this.t(this.documents.canSaveXml() ? 'file.save' : 'file.saveCopy'));
}
