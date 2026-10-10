import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { POSTER_THEMES } from '../../../core/poster/themes';
import { I18n } from '../../../i18n/i18n';

/** The print styles, each with its colours and a line about it. */
@Component({
  selector: 'stemma-style-picker',
  templateUrl: './style-picker.html',
  styleUrl: './style-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'studio-group', role: 'group', 'aria-labelledby': 'print-g-style' },
})
export class StylePicker {
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly current = input.required<string>();
  readonly choose = output<string>();

  /** Styles show their translated name when the app has one, else the name they bring. */
  protected readonly themes = computed(() =>
    POSTER_THEMES.map((theme) => ({
      id: theme.id,
      swatch: theme.swatch,
      name: this.i18n.textOr(`theme.${theme.id}.name`, theme.name),
      description: this.i18n.textOr(`theme.${theme.id}.description`, theme.description),
    })),
  );
}
