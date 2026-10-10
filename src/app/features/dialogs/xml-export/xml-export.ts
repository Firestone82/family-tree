import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ToastService } from '../../../core/services/toast';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { DocumentActions } from '../../../state/document-actions';

/** Where .xml files cannot be downloaded: the XML to copy, or to save as a text file. */
@Component({
  selector: 'stemma-xml-export',
  imports: [Icon],
  templateUrl: './xml-export.html',
  styleUrl: './xml-export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XmlExport {
  private readonly toast = inject(ToastService);
  protected readonly documents = inject(DocumentActions);
  protected readonly t = inject(I18n).t;

  readonly xml = input.required<string>();
  readonly filename = input.required<string>();
  readonly done = output<void>();

  /** The sentence around the file name, which is shown in bold. */
  protected readonly text = computed(() => {
    const [before, after = ''] = this.t('dialog.xml.text').split('{filename}');
    return { before, after };
  });

  protected copy(area: HTMLTextAreaElement): void {
    const fallback = () => {
      area.focus();
      area.select();
      this.toast.show(this.t('dialog.xml.selected'));
    };
    try {
      navigator.clipboard.writeText(this.xml()).then(() => this.toast.show(this.t('dialog.xml.copied')), fallback);
    } catch {
      fallback();
    }
  }
}
