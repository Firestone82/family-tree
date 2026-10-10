import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { relationshipStatus } from '../../../../../core/model/relationship';
import { ChildRelation, Person } from '../../../../../core/model/types';
import { TreeStore } from '../../../../../core/store/tree-store';
import { I18n } from '../../../../../i18n/i18n';
import { STATUS_LABEL, bornTogetherTag } from '../../../../../i18n/labels';
import { MessageKey } from '../../../../../i18n/locales';
import { Icon } from '../../../../../shared/icon/icon';
import { PersonRow } from '../../../../../shared/person-row/person-row';
import { PersonActions } from '../../../../../state/person-actions';
import { RelationshipEditor } from '../../../relationship-editor/relationship-editor';
import { PersonRows, Row } from '../person-rows';

const CHILD_TAG: Record<ChildRelation, MessageKey | null> = {
  biological: null,
  adopted: 'childTag.adopted',
  foster: 'childTag.foster',
  step: 'childTag.step',
  unknown: 'childTag.unknown',
};

/** Each partner, with the relationship (editable in place) and the children they have together. */
@Component({
  selector: 'stemma-couple-list',
  imports: [Icon, PersonRow, RelationshipEditor],
  templateUrl: './couple-list.html',
  styleUrl: './couple-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoupleList {
  private readonly store = inject(TreeStore);
  private readonly rows = inject(PersonRows);
  private readonly i18n = inject(I18n);
  protected readonly people = inject(PersonActions);
  protected readonly t = this.i18n.t;

  readonly person = input.required<Person>();

  protected readonly couples = computed(() => {
    const index = this.store.index();
    const id = this.person().id;
    return index.partnerFamilies(id).map((f) => {
      const partner = index.person(f.partners.find((p) => p !== id));
      return {
        family: f,
        partner: partner ? { ...this.rows.row(partner), given: partner.name.given || this.i18n.name(partner) } : undefined,
        status: STATUS_LABEL[relationshipStatus(f)],
        children: f.children
          .map((c) => {
            const child = index.person(c.personId);
            const tag = CHILD_TAG[c.relation];
            const together = c.birthGroup ? f.children.filter((x) => x.birthGroup === c.birthGroup).length : 0;
            const tags = [tag ? this.t(tag) : '', together > 1 ? bornTogetherTag(this.t, together) : ''].filter(Boolean);
            return child ? { ...this.rows.row(child), tag: tags.join(', ') } : null;
          })
          .filter((c): c is Row & { tag: string } => !!c),
      };
    });
  });

  protected addChild(partnerId: string | null): void {
    this.people.startAdd('child', this.person().id, partnerId);
  }
}
