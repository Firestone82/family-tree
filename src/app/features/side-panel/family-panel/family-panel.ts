import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { displayName } from '../../../core/model/names';
import { relationshipStatus } from '../../../core/model/relationship';
import { Family, Person } from '../../../core/model/types';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { MessageKey } from '../../../i18n/locales';
import { Icon } from '../../../shared/icon/icon';
import { PersonRow } from '../../../shared/person-row/person-row';
import { ChartModel } from '../../../state/chart-model';
import { FamilyActions } from '../../../state/family-actions';
import { PersonActions } from '../../../state/person-actions';
import { RelationshipEditor } from '../relationship-editor/relationship-editor';
import { FamilyChildren } from './family-children/family-children';

/** A couple (or a lone parent, or siblings whose parents are not known) and their children. */
@Component({
  selector: 'stemma-family-panel',
  imports: [Icon, PersonRow, RelationshipEditor, FamilyChildren],
  templateUrl: './family-panel.html',
  styleUrl: './family-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyPanel {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly i18n = inject(I18n);
  protected readonly families = inject(FamilyActions);
  protected readonly people = inject(PersonActions);
  protected readonly t = this.i18n.t;

  readonly family = input.required<Family>();

  protected readonly partners = computed(() =>
    this.family()
      .partners.map((id) => this.store.index().person(id))
      .filter((p): p is Person => !!p)
      .map((p) => ({ id: p.id, name: displayName(p), dates: this.i18n.lifespan(p), tincture: this.model.colors().byPerson.get(p.id) ?? 'argent' })),
  );

  protected readonly title = computed(() => this.t(titleKey(this.family())));

  protected readonly subtitle = computed(() => {
    const names = this.partners().map((p) => p.name);
    return names.length ? this.i18n.list(names) : this.t('familyPanel.noParents');
  });

  protected setNotes(event: Event): void {
    const notes = (event.target as HTMLTextAreaElement).value;
    this.families.update(this.family().id, { notes: notes.trim() ? notes : undefined }, 'notes');
  }
}

function titleKey(f: Family): MessageKey {
  if (!f.partners.length) return 'familyPanel.siblings';
  if (f.partners.length === 1) return 'familyPanel.oneParent';
  switch (relationshipStatus(f)) {
    case 'married':
    case 'widowed':
      return 'familyPanel.marriage';
    case 'engaged':
      return 'familyPanel.engagement';
    case 'divorced':
    case 'annulled':
      return 'familyPanel.formerMarriage';
    case 'partners':
      return 'familyPanel.partnership';
    case 'separated':
    case 'ended':
      return 'familyPanel.formerRelationship';
    default:
      return 'familyPanel.relationship';
  }
}
