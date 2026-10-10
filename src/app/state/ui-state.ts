import { Injectable, computed, inject, signal } from '@angular/core';
import { Notice } from '../core/model/notice';
import { TreeStore } from '../core/store/tree-store';

export type Relation = 'parent' | 'partner' | 'child' | 'sibling';

export interface AddRequest {
  relation: Relation;
  personId: string;
  /** For a child: the other parent to preselect (a person id), or null for none. */
  otherParentId?: string | null;
}

export type DialogRequest =
  | { kind: 'confirm-delete'; personId: string }
  | { kind: 'confirm-new' }
  | { kind: 'import-report'; title: string; notes: Notice[]; upgrades: Notice[] }
  | { kind: 'newer-version'; notice: Notice; xml: string; name: string }
  | { kind: 'xml'; xml: string; filename: string }
  | { kind: 'about' };

export type MenuName = 'file' | 'appearance' | 'relatives';

/** Peek height of the bottom sheet on phones, in pixels. */
export const SHEET_PEEK = 196;

/** UI state that is not part of the tree: open panels, menus and requests between components. */
@Injectable({ providedIn: 'root' })
export class UiState {
  private readonly store = inject(TreeStore);

  readonly adding = signal<AddRequest | null>(null);
  readonly dialog = signal<DialogRequest | null>(null);
  readonly menu = signal<MenuName | null>(null);
  /** The print and export studio is open. */
  readonly printOpen = signal(false);
  /** On small screens: the people list sheet. */
  readonly peopleOpen = signal(false);
  /** On small screens: whether the person sheet is pulled up. */
  readonly sheetExpanded = signal(false);
  /** The tree from the last visit is still being read (a big one, from IndexedDB). */
  readonly restoring = signal(false);
  /** The example family is showing and the note about it has not been dismissed. */
  readonly showSampleNote = signal(false);
  /** Family groups in the people list opened or closed by hand, by family key. */
  readonly familyOpen = signal<ReadonlyMap<string, boolean>>(new Map());

  /** Requests for the chart: centre on a person, or fit everything in view. */
  readonly focusRequest = signal<{ personId: string; seq: number } | null>(null);
  /** Bring a person and their partner to the middle of the chart. */
  readonly centreRequest = signal<{ personId: string; seq: number } | null>(null);
  readonly fitRequest = signal(0);
  /** A person to briefly highlight after they were added. */
  readonly flash = signal<{ personId: string; seq: number } | null>(null);
  /** The field to focus when the person panel opens next. */
  readonly focusField = signal<string | null>(null);
  /** The chart is being arranged by hand: cards and family lines can be dragged. */
  readonly arranging = signal(false);
  /** Phone-sized screen: the panel becomes a bottom sheet. */
  readonly narrow = signal(false);
  readonly viewportHeight = signal(typeof innerHeight === 'number' ? innerHeight : 800);

  /** The panel is showing (always on wide screens; on phones when there is something in it). */
  readonly sheetOpen = computed(() => !this.narrow() || !!this.adding() || !!this.store.selection() || this.peopleOpen());
  /** On phones: the sheet is pulled up to most of the screen. */
  readonly sheetFull = computed(() => this.narrow() && (this.sheetExpanded() || !!this.adding() || (this.peopleOpen() && !this.store.selection())));
  /** How much of the chart the bottom sheet covers on phones. */
  readonly chartInsetBottom = computed(() => {
    if (!this.narrow() || !this.sheetOpen()) return 0;
    return this.sheetFull() ? Math.round((this.viewportHeight() - 52) * 0.82) : SHEET_PEEK;
  });

  private seq = 0;

  constructor() {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(max-width: 860px)');
    this.narrow.set(mq.matches);
    mq.addEventListener('change', (e) => this.narrow.set(e.matches));
    window.addEventListener('resize', () => this.viewportHeight.set(window.innerHeight));
  }

  focus(personId: string): void {
    this.focusRequest.set({ personId, seq: ++this.seq });
  }

  centre(personId: string): void {
    this.centreRequest.set({ personId, seq: ++this.seq });
  }

  fit(): void {
    this.fitRequest.update((v) => v + 1);
  }

  highlight(personId: string): void {
    this.flash.set({ personId, seq: ++this.seq });
  }

  /** Back to the tree overview (on phones, the list of people). */
  showOverview(): void {
    this.closeMenu();
    this.adding.set(null);
    this.store.selection.set(null);
    if (this.narrow()) this.peopleOpen.set(true);
  }

  togglePeople(): void {
    this.closeMenu();
    this.adding.set(null);
    this.store.selection.set(null);
    this.peopleOpen.set(!this.peopleOpen());
  }

  toggleMenu(menu: MenuName): void {
    this.menu.set(this.menu() === menu ? null : menu);
  }

  closeMenu(): void {
    this.menu.set(null);
  }
}
