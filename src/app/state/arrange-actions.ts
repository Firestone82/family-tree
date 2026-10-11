import { Injectable, inject } from '@angular/core';
import { isArranged, moveCards, moveLine, resetArrangement, resetCards, resetLine, setLeftPartner } from '../core/model/arrangement';
import { ToastService } from '../core/services/toast';
import { TreeStore } from '../core/store/tree-store';
import { I18n } from '../i18n/i18n';

/** Changes made by hand to the chart's layout: each one an undoable edit of the tree. */
@Injectable({ providedIn: 'root' })
export class ArrangeActions {
  private readonly store = inject(TreeStore);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);

  /** Moves a couple (all of `personIds`) sideways by `dx` chart units. */
  moveCouple(personIds: readonly string[], dx: number): void {
    if (Math.abs(dx) < 0.5) return;
    this.store.update((doc) => moveCards(doc, personIds, dx));
  }

  /** Moves a family's line down by `dy` (up when negative). */
  moveLine(familyId: string, dy: number): void {
    if (Math.abs(dy) < 0.5) return;
    this.store.update((doc) => moveLine(doc, familyId, dy));
  }

  /** Puts `personId` on the left of their partner. */
  turnCouple(familyId: string, personId: string): void {
    this.store.update((doc) => setLeftPartner(doc, familyId, personId));
  }

  putBackCouple(personIds: readonly string[]): void {
    this.store.update((doc) => resetCards(doc, personIds));
  }

  putBackLine(familyId: string): void {
    this.store.update((doc) => resetLine(doc, familyId));
  }

  /** Back to the automatic layout everywhere, with a way back. */
  resetAll(): void {
    if (!isArranged(this.store.doc())) return;
    this.store.update((doc) => resetArrangement(doc));
    this.toast.show(this.i18n.t('arrange.resetDone'), { action: { label: this.i18n.t('common.undo'), run: () => this.store.undo() } });
  }
}
