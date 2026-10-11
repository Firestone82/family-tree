import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, ICON_FILLS } from './icons';

/** A line icon from the app's set, some with a filled part. Decorative: label the button around it instead. */
@Component({
  selector: 'stemma-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly stroke = input(1.75);
  protected readonly path = computed(() => ICONS[this.name()] ?? '');
  protected readonly fill = computed(() => ICON_FILLS[this.name()] ?? '');
}
