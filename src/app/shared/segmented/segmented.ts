import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';

export interface SegmentOption<T> {
  value: T;
  label: string;
  /** Language of the label, when it is not the app's (language names). */
  lang?: string;
  disabled?: boolean;
}

/** A row of mutually exclusive choices that looks like tabs (a radio group). */
@Component({
  selector: 'stemma-segmented',
  templateUrl: './segmented.html',
  styleUrl: './segmented.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compact]': 'compact()' },
})
export class Segmented<T> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = input<T>();
  /** Accessible name of the group, or the id of the element that names it. */
  readonly label = input<string>();
  readonly labelledBy = input<string>();
  readonly disabled = input(false);
  /** Smaller text, for narrow menus. */
  readonly compact = input(false);
  readonly valueChange = output<T>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected choose(option: SegmentOption<T>): void {
    if (option.value !== this.value()) this.valueChange.emit(option.value);
  }

  /** Arrow keys move between the choices, as in any radio group. */
  protected onKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const options = this.options();
    for (let i = 1; i <= options.length; i++) {
      const next = (index + step * i + options.length) % options.length;
      if (options[next].disabled) continue;
      this.choose(options[next]);
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      return;
    }
  }
}
