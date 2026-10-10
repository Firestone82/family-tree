import { Injectable, inject } from '@angular/core';
import {
  AddChildOptions,
  AddPartnerOptions,
  OpResult,
  PersonDraft,
  PersonPatch,
  PersonSource,
  TreeOperationError,
  addChild,
  addParent,
  addPartner,
  addPerson,
  addSibling,
  deletePerson,
  removeChild,
  removePartner,
  updateMeta,
  updatePerson,
  updateView,
} from '../core/model/operations';
import { linkBirth, shareBirth } from '../core/model/births';
import { ChildRelation, Person } from '../core/model/types';
import { relativesOf, relativesSettings } from '../core/poster/scope';
import { ToastService } from '../core/services/toast';
import { TreeStore } from '../core/store/tree-store';
import { I18n } from '../i18n/i18n';
import { ChartModel } from './chart-model';
import { Relation, UiState } from './ui-state';

export interface AddRelativeOptions {
  relation?: ChildRelation;
  onlyThisChild?: boolean;
  partner?: AddPartnerOptions;
  child?: AddChildOptions;
  /** A new sibling was born together with the person (a twin). */
  twin?: boolean;
}

/** People: selecting, adding relatives, editing, centring the tree, deleting. */
@Injectable({ providedIn: 'root' })
export class PersonActions {
  private readonly store = inject(TreeStore);
  private readonly ui = inject(UiState);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly model = inject(ChartModel);

  addLoosePerson(draft: PersonDraft = {}): string {
    const { personId } = this.store.apply((doc) => addPerson(doc, draft));
    this.store.selectPerson(personId);
    this.ui.focusField.set('given');
    this.ui.sheetExpanded.set(true);
    this.ui.highlight(personId);
    return personId;
  }

  startAdd(relation: Relation, personId: string, otherParentId?: string | null): void {
    this.store.selectPerson(personId);
    this.ui.adding.set({ relation, personId, otherParentId });
    this.ui.sheetExpanded.set(true);
  }

  cancelAdd(): void {
    this.ui.adding.set(null);
  }

  /** Runs an add operation, reports problems in plain words, and highlights the result. */
  addRelative(relation: Relation, personId: string, source: PersonSource, options: AddRelativeOptions = {}): OpResult | null {
    try {
      const result = this.store.apply((doc) => {
        switch (relation) {
          case 'parent':
            return addParent(doc, personId, source, options.relation ?? 'biological', { onlyThisChild: options.onlyThisChild });
          case 'partner':
            return addPartner(doc, personId, source, options.partner);
          case 'child':
            return addChild(doc, personId, source, options.child ?? { otherParentId: null, relation: options.relation });
          case 'sibling': {
            const added = addSibling(doc, personId, source);
            return options.twin ? { ...added, doc: linkBirth(added.doc, added.familyId, [personId, added.personId]) } : added;
          }
        }
      });
      const added = this.store.index().person(result.personId);
      this.ui.adding.set(null);
      // On a phone, drop the sheet back down so the new person can be seen arriving.
      if (this.ui.narrow()) this.ui.sheetExpanded.set(false);
      this.ui.highlight(result.personId);
      if (this.model.hidden().has(result.personId)) {
        // The Relatives setting leaves the new person out of the chart: say so, and offer everyone.
        const level = this.i18n.t(`relatives.${relativesOf(this.model.view())}`);
        this.toast.show(this.i18n.t('person.addedHidden', { name: this.name(added), level }), {
          action: { label: this.i18n.t('relatives.showEveryone'), run: () => this.showEveryone(result.personId) },
        });
      } else {
        this.toast.show(this.i18n.t('person.added', { name: this.name(added) }), {
          action: { label: this.i18n.t('common.open'), run: () => this.select(result.personId) },
        });
      }
      return result;
    } catch (e) {
      if (e instanceof TreeOperationError) this.toast.error(this.i18n.notice(e, 'op.'));
      else throw e;
      return null;
    }
  }

  /** Shows the whole tree on the chart (the Relatives setting at Everyone), and opens `personId`. */
  showEveryone(personId?: string): void {
    this.store.update((doc) => updateView(doc, relativesSettings('everyone')));
    if (personId) this.select(personId);
  }

  select(personId: string): void {
    this.ui.adding.set(null);
    this.store.selectPerson(personId);
    this.ui.focus(personId);
  }

  close(): void {
    this.store.selectPerson(null);
  }

  openFamily(familyId: string): void {
    this.ui.adding.set(null);
    this.store.selectFamily(familyId);
  }

  /**
   * Centres the tree on someone: the view moves to them and their partner, and
   * relationship names on the cards are given from their point of view.
   * Saved with the tree as its home person.
   */
  centreOn(personId: string): void {
    const person = this.store.index().person(personId);
    if (!person) return;
    if (this.store.doc().meta.homePersonId !== personId) {
      this.store.update((doc) => updateMeta(doc, { homePersonId: personId }));
      this.toast.show(this.i18n.t('person.centred', { name: this.name(person) }));
    }
    this.ui.centre(personId);
  }

  /** Changes a person's details. Typing in one field is merged into one undo step. */
  /** Changes a person's details; a new date or place of birth goes to their twins too. */
  update(personId: string, patch: PersonPatch, field: string): void {
    this.store.update((doc) => {
      const next = updatePerson(doc, personId, patch);
      return 'birth' in patch ? shareBirth(next, personId) : next;
    }, `person:${personId}:${field}`);
  }

  askDelete(personId: string): void {
    this.ui.dialog.set({ kind: 'confirm-delete', personId });
  }

  confirmDelete(personId: string): void {
    const person = this.store.index().person(personId);
    this.store.update((doc) => deletePerson(doc, personId));
    this.ui.dialog.set(null);
    this.ui.adding.set(null);
    this.toast.show(this.i18n.t('person.deleted', { name: this.name(person) }), this.undoAction());
  }

  unlinkFromParents(familyId: string, personId: string): void {
    const name = this.name(this.store.index().person(personId));
    this.store.update((doc) => removeChild(doc, familyId, personId));
    this.toast.show(this.i18n.t('person.unlinkedParents', { name }), this.undoAction());
  }

  unlinkPartner(familyId: string, personId: string, partnerId: string): void {
    const index = this.store.index();
    const names = { name: this.name(index.person(personId)), partner: this.name(index.person(partnerId)) };
    this.store.update((doc) => removePartner(doc, familyId, partnerId));
    this.toast.show(this.i18n.t('person.unlinkedPartner', names), this.undoAction());
  }

  unlinkChild(familyId: string, childId: string): void {
    const name = this.name(this.store.index().person(childId));
    this.store.update((doc) => removeChild(doc, familyId, childId));
    this.toast.show(this.i18n.t('person.unlinkedChild', { name }), this.undoAction());
  }

  undo(): void {
    if (this.store.canUndo()) this.store.undo();
  }

  redo(): void {
    if (this.store.canRedo()) this.store.redo();
  }

  private name(person: Person | undefined): string {
    return this.i18n.name(person);
  }

  private undoAction() {
    return { action: { label: this.i18n.t('common.undo'), run: () => this.store.undo() } };
  }
}
