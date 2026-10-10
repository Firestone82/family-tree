import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** An on/off setting: the label (projected content) on the left, the switch on the right. */
@Component({
  selector: 'stemma-switch',
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Switch {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly checkedChange = output<boolean>();

  protected onChange(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
