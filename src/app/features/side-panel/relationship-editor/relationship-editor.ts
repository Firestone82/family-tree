import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RELATIONSHIP_STATUSES, RelationshipStatus, relationshipStatus } from '../../../core/model/relationship';
import { Family } from '../../../core/model/types';
import { I18n } from '../../../i18n/i18n';
import { STATUS_LABEL } from '../../../i18n/labels';
import { FamilyActions } from '../../../state/family-actions';

/**
 * A couple's status. Dates and places of an engagement, a wedding or a parting
 * are not asked for; those in a file are kept and saved back unchanged.
 */
@Component({
  selector: 'stemma-relationship-editor',
  templateUrl: './relationship-editor.html',
  styleUrl: './relationship-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelationshipEditor {
  private readonly families = inject(FamilyActions);
  protected readonly t = inject(I18n).t;

  readonly family = input.required<Family>();

  protected readonly statuses = RELATIONSHIP_STATUSES;
  protected readonly labels = STATUS_LABEL;
  protected readonly status = computed(() => relationshipStatus(this.family()));

  protected setStatus(event: Event): void {
    this.families.setStatus(this.family().id, (event.target as HTMLSelectElement).value as RelationshipStatus);
  }
}
