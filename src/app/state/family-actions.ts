import { Injectable, inject } from '@angular/core';
import {
  FamilyPatch,
  deleteFamily,
  moveChild,
  removeChild,
  removePartner,
  setChildRelation,
  setRelationshipStatus,
  sortChildrenByBirth,
  updateFamily,
} from '../core/model/operations';
import { linkBirth, splitBirth } from '../core/model/births';
import { RelationshipStatus } from '../core/model/relationship';
import { ChildRelation } from '../core/model/types';
import { ToastService } from '../core/services/toast';
import { TreeStore } from '../core/store/tree-store';
import { I18n } from '../i18n/i18n';
import { PersonActions } from './person-actions';

/** Couples and their children: status, dates, the order of children, removing links. */
@Injectable({ providedIn: 'root' })
export class FamilyActions {
  private readonly store = inject(TreeStore);
  private readonly people = inject(PersonActions);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  /** Changes a family's details. Typing in one field is merged into one undo step. */
  update(familyId: string, patch: FamilyPatch, field?: string): void {
    this.store.update((doc) => updateFamily(doc, familyId, patch), field ? `family:${familyId}:${field}` : undefined);
  }

  setStatus(familyId: string, status: RelationshipStatus): void {
    this.store.update((doc) => setRelationshipStatus(doc, familyId, status));
  }

  setChildRelation(familyId: string, childId: string, relation: ChildRelation): void {
    this.store.update((doc) => setChildRelation(doc, familyId, childId, relation));
  }

  moveChild(familyId: string, childId: string, delta: number): void {
    this.store.update((doc) => moveChild(doc, familyId, childId, delta));
  }

  /** Two or more children were born together; they share the date and place of birth from now on. */
  linkBirth(familyId: string, childIds: readonly string[]): void {
    this.store.update((doc) => linkBirth(doc, familyId, childIds));
  }

  /** The child and the one after them were not born together after all. */
  splitBirth(familyId: string, afterChildId: string): void {
    this.store.update((doc) => splitBirth(doc, familyId, afterChildId));
  }

  sortChildren(familyId: string): void {
    this.store.update((doc) => sortChildrenByBirth(doc, familyId));
    this.toast.show(this.i18n.t('family.sorted'));
  }

  removeChild(familyId: string, childId: string): void {
    const name = this.i18n.name(this.store.index().person(childId));
    this.store.update((doc) => removeChild(doc, familyId, childId));
    this.toast.show(this.i18n.t('family.childRemoved', { name }), this.undoAction());
  }

  removePartner(familyId: string, personId: string): void {
    const name = this.i18n.name(this.store.index().person(personId));
    this.store.update((doc) => removePartner(doc, familyId, personId));
    this.toast.show(this.i18n.t('family.partnerRemoved', { name }), this.undoAction());
  }

  /** Starts adding a child to the family (or a sibling, when nobody is a parent yet). */
  addChild(familyId: string): void {
    const f = this.store.index().family(familyId);
    if (!f) return;
    const [a, b] = f.partners;
    if (a) this.people.startAdd('child', a, b ?? null);
    else if (f.children[0]) this.people.startAdd('sibling', f.children[0].personId);
  }

  remove(familyId: string): void {
    const f = this.store.index().family(familyId);
    if (!f) return;
    const first = f.partners[0] ?? f.children[0]?.personId;
    this.store.update((doc) => deleteFamily(doc, familyId));
    if (first) this.store.selectPerson(first);
    this.toast.show(this.i18n.t('family.removed'), this.undoAction());
  }

  close(): void {
    this.store.selectFamily(null);
  }

  private undoAction() {
    return { action: { label: this.i18n.t('common.undo'), run: () => this.store.undo() } };
  }
}
