import { Injectable, inject } from '@angular/core';
import { TreeStore } from '../core/store/tree-store';
import { DocumentActions } from './document-actions';
import { PersonActions } from './person-actions';
import { UiState } from './ui-state';

/** Keyboard shortcuts for the whole app; the chart has its own for moving around. */
@Injectable({ providedIn: 'root' })
export class Shortcuts {
  private readonly store = inject(TreeStore);
  private readonly ui = inject(UiState);
  private readonly documents = inject(DocumentActions);
  private readonly people = inject(PersonActions);

  handle(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    const target = e.target as HTMLElement | null;
    const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.people.redo();
      else this.people.undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      this.people.redo();
    } else if (mod && key === 's') {
      e.preventDefault();
      void this.documents.saveXml();
    } else if (mod && key === 'o') {
      e.preventDefault();
      void this.documents.openFile();
    } else if (mod && key === 'p') {
      e.preventDefault();
      this.documents.openPrint();
    } else if (e.key === 'Escape') {
      this.escape();
    } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
      const person = this.store.selectedPerson();
      if (person && !this.ui.dialog()) {
        e.preventDefault();
        this.people.askDelete(person.id);
      }
    }
  }

  /** Escape closes the innermost thing that is open. Dialogs close themselves. */
  private escape(): void {
    if (this.ui.dialog() || this.ui.printOpen()) return;
    if (this.ui.menu()) this.ui.closeMenu();
    else if (this.ui.adding()) this.ui.adding.set(null);
    else if (this.ui.sheetExpanded() && this.ui.narrow()) this.ui.sheetExpanded.set(false);
    else if (this.store.selection()) this.store.selection.set(null);
    else this.ui.peopleOpen.set(false);
  }

  /** A click outside an open menu closes it. */
  pointer(e: PointerEvent): void {
    if (!this.ui.menu()) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.menu-anchor')) this.ui.closeMenu();
  }
}
