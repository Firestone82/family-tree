import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FamilyPatch } from '../../../core/model/operations';
import { RELATIONSHIP_STATUSES, RelationshipStatus, hasEnd, relationshipStatus } from '../../../core/model/relationship';
import { Family, FamilyEnd, GenDate, LifeEvent } from '../../../core/model/types';
import { I18n } from '../../../i18n/i18n';
import { STATUS_LABEL } from '../../../i18n/labels';
import { MessageKey } from '../../../i18n/locales';
import { DateField } from '../../../shared/date-field/date-field';
import { FamilyActions } from '../../../state/family-actions';

type EventKey = 'engagement' | 'start' | 'end';

const END_LABEL: Partial<Record<RelationshipStatus, MessageKey>> = {
  separated: 'rel.end.separated',
  divorced: 'rel.end.divorced',
  widowed: 'rel.end.widowed',
  annulled: 'rel.end.annulled',
  ended: 'rel.end.ended',
};

/** A couple's status, and the dates and places of their engagement, wedding and parting. */
@Component({
  selector: 'stemma-relationship-editor',
  imports: [DateField],
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
  protected readonly endLabel = computed(() => (hasEnd(this.status()) ? END_LABEL[this.status()] : undefined));

  protected setStatus(event: Event): void {
    this.families.setStatus(this.family().id, (event.target as HTMLSelectElement).value as RelationshipStatus);
  }

  protected setDate(key: EventKey, date: GenDate | undefined): void {
    this.patch(key, { ...this.family()[key], date }, `${key}.date`);
  }

  protected setPlace(key: EventKey, event: Event): void {
    const place = (event.target as HTMLInputElement).value;
    this.patch(key, { ...this.family()[key], place: place || undefined }, `${key}.place`);
  }

  private patch(key: EventKey, event: FamilyEnd, field: string): void {
    // An engagement or an end stays even when its date and place are cleared: it carries the status.
    const value = compact(event, key === 'engagement' || key === 'end');
    this.families.update(this.family().id, { [key]: value } as FamilyPatch, field);
  }
}

function compact<T extends LifeEvent>(e: T, keep: boolean): T | undefined {
  const out = { ...e };
  if (!out.date || !(out.date.value || out.date.text)) delete out.date;
  if (!out.place?.trim()) delete out.place;
  return Object.keys(out).length || keep ? out : undefined;
}
