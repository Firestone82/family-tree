import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ChildRelation } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';

/** For a new parent: birth, adoptive, foster or step, and whether they also parent the siblings. */
@Component({
  selector: 'stemma-parent-options',
  imports: [Segmented],
  templateUrl: './parent-options.html',
  styleUrl: './parent-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class ParentOptions {
  protected readonly t = inject(I18n).t;

  readonly relation = input.required<ChildRelation>();
  /** The other children of the same parents, and whether sharing the new parent is optional. */
  readonly shared = input<{ names: string; optional: boolean } | null>(null);
  readonly withSiblings = input(true);
  readonly relationChange = output<ChildRelation>();
  readonly withSiblingsChange = output<boolean>();

  protected readonly relations = computed<SegmentOption<ChildRelation>[]>(() =>
    (['biological', 'adopted', 'foster', 'step'] as const).map((value) => ({ value, label: this.t(`childKind.${value}`) })),
  );

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
