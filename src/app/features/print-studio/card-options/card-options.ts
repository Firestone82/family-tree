import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PrintSettings } from '../../../core/model/types';
import { I18n } from '../../../i18n/i18n';
import { MessageKey } from '../../../i18n/locales';
import { BackgroundPicker } from '../../../shared/background-picker/background-picker';
import { Switch } from '../../../shared/switch/switch';
import { PrintModel } from '../print-model';

type CardKey = 'showRelationships' | 'showDates' | 'showPlaces' | 'showPhotos' | 'showGenerations' | 'showSex' | 'sexColors' | 'showTree';

const SWITCHES: readonly { key: CardKey; label: MessageKey }[] = [
  { key: 'showRelationships', label: 'display.relationships' },
  { key: 'showDates', label: 'display.dates' },
  { key: 'showPlaces', label: 'display.places' },
  { key: 'showPhotos', label: 'display.photos' },
  { key: 'showGenerations', label: 'display.generations' },
  { key: 'showSex', label: 'display.sexSymbol' },
  { key: 'sexColors', label: 'display.sexColors' },
  { key: 'showTree', label: 'display.tree' },
];

/**
 * What the cards and the page show, and the picture behind the tree. The
 * words on the page are in the app's language (Appearance), and every couple
 * has a note saying how they stand.
 */
@Component({
  selector: 'stemma-card-options',
  imports: [Switch, BackgroundPicker],
  templateUrl: './card-options.html',
  styleUrl: './card-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'studio-group', role: 'group', 'aria-labelledby': 'print-g-cards' },
})
export class CardOptions {
  protected readonly model = inject(PrintModel);
  protected readonly t = inject(I18n).t;

  protected readonly switches = computed(() => {
    const s = this.model.settings();
    return SWITCHES.map((x) => ({ ...x, on: s[x.key] }));
  });

  protected readonly showTree = computed(() => this.model.settings().showTree);

  protected toggle(key: CardKey, on: boolean): void {
    this.model.set({ [key]: on } as Partial<PrintSettings>);
  }
}
