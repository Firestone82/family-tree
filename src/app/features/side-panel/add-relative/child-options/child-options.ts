import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ChildRelation, Person } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { SegmentOption, Segmented } from '../../../../shared/segmented/segmented';

/** For a new child: who the other parent is, and how the child is related. */
@Component({
  selector: 'stemma-child-options',
  imports: [Segmented],
  templateUrl: './child-options.html',
  styleUrl: './child-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class ChildOptions {
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  /** The person's partners, any of whom could be the other parent. */
  readonly partners = input.required<readonly Person[]>();
  readonly otherParentId = input<string | null>(null);
  readonly relation = input.required<ChildRelation>();
  readonly otherParentChange = output<string | null>();
  readonly relationChange = output<ChildRelation>();

  protected readonly options = computed(() => this.partners().map((p) => ({ id: p.id, name: this.i18n.name(p) })));
  protected readonly relations = computed<SegmentOption<ChildRelation>[]>(() =>
    (['biological', 'adopted', 'foster', 'step'] as const).map((value) => ({ value, label: this.t(`childKind.${value}`) })),
  );
}
