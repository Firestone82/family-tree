import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ViewSettings } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { MessageKey } from '../../../../i18n/locales';
import { Switch } from '../../../../shared/switch/switch';

type DisplayKey = 'showRelationships' | 'showDates' | 'showPhotos' | 'showGenerations' | 'showSex' | 'sexColors';

const SWITCHES: readonly { key: DisplayKey; label: MessageKey }[] = [
  { key: 'showRelationships', label: 'display.relationships' },
  { key: 'showDates', label: 'display.dates' },
  { key: 'showPhotos', label: 'display.photos' },
  { key: 'showGenerations', label: 'display.generations' },
  { key: 'showSex', label: 'display.sexSymbol' },
  { key: 'sexColors', label: 'display.sexColors' },
];

/** What the chart shows: on/off switches. */
@Component({
  selector: 'stemma-display-options',
  imports: [Switch],
  templateUrl: './display-options.html',
  styleUrl: './display-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayOptions {
  protected readonly t = inject(I18n).t;

  readonly view = input.required<ViewSettings>();
  readonly settingsChange = output<Partial<ViewSettings>>();

  protected readonly switches = computed(() => SWITCHES.map((s) => ({ ...s, on: this.view()[s.key] })));

  protected toggle(key: DisplayKey, on: boolean): void {
    this.settingsChange.emit({ [key]: on });
  }
}
