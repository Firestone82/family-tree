import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RELATIONSHIP_STATUSES, RelationshipStatus } from '../../../../core/model/relationship';
import { I18n } from '../../../../i18n/i18n';
import { STATUS_LABEL } from '../../../../i18n/labels';

/**
 * For a new partner: how the couple stand (married, engaged, divorced,
 * widowed…), and whether they are the other parent of children already there.
 */
@Component({
  selector: 'stemma-partner-options',
  templateUrl: './partner-options.html',
  styleUrl: './partner-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class PartnerOptions {
  protected readonly t = inject(I18n).t;

  readonly status = input.required<RelationshipStatus>();
  /** Names of children with no other parent recorded, or empty. */
  readonly orphans = input('');
  readonly join = input(true);
  readonly statusChange = output<RelationshipStatus>();
  readonly joinChange = output<boolean>();

  protected readonly statuses = computed(() => RELATIONSHIP_STATUSES.map((value) => ({ value, label: this.t(STATUS_LABEL[value]) })));

  protected choose(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as RelationshipStatus);
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
