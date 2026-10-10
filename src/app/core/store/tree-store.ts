import { Injectable, computed, signal } from '@angular/core';
import { TreeIndex } from '../model/tree-index';
import { Family, Person, TreeDocument, emptyDocument } from '../model/types';

export type Selection = { kind: 'person'; id: string } | { kind: 'family'; id: string } | null;

interface HistoryEntry {
  doc: TreeDocument;
  selection: Selection;
}

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1500;

/**
 * The open tree and its edit history. Edits are pure functions over immutable
 * documents (see model/operations.ts), so undo and redo keep whole snapshots.
 */
@Injectable({ providedIn: 'root' })
export class TreeStore {
  private readonly _doc = signal<TreeDocument>(emptyDocument());
  readonly doc = this._doc.asReadonly();
  readonly index = computed(() => new TreeIndex(this._doc()));

  readonly selection = signal<Selection>(null);
  /** Changes when a different tree is opened, not when the current one is edited. */
  readonly loadId = signal(0);
  /** Changes on every edit, undo and redo; used for autosave. */
  readonly revision = signal(0);

  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private readonly historyTick = signal(0);
  private lastCoalesce?: { key: string; at: number };

  readonly canUndo = computed(() => (this.historyTick(), this.past.length > 0));
  readonly canRedo = computed(() => (this.historyTick(), this.future.length > 0));

  readonly selectedPerson = computed<Person | undefined>(() => {
    const s = this.selection();
    return s?.kind === 'person' ? this.index().person(s.id) : undefined;
  });

  readonly selectedFamily = computed<Family | undefined>(() => {
    const s = this.selection();
    return s?.kind === 'family' ? this.index().family(s.id) : undefined;
  });

  /**
   * Replaces the document and records an undo step. Edits with the same
   * `coalesce` key in quick succession (typing in a field) share one step.
   */
  commit(next: TreeDocument, coalesce?: string): void {
    const prev = this._doc();
    if (next === prev) return;
    const now = Date.now();
    const merge = !!coalesce && this.lastCoalesce?.key === coalesce && now - this.lastCoalesce.at < COALESCE_MS;
    if (!merge) {
      this.past.push({ doc: prev, selection: this.selection() });
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.lastCoalesce = coalesce ? { key: coalesce, at: now } : undefined;
    this.future = [];
    this._doc.set({ ...next, meta: { ...next.meta, modified: new Date(now).toISOString() } });
    this.changed();
  }

  /** Runs an operation that returns `{ doc, ... }` and commits its document. */
  apply<T extends { doc: TreeDocument }>(op: (doc: TreeDocument) => T, coalesce?: string): T {
    const result = op(this._doc());
    this.commit(result.doc, coalesce);
    return result;
  }

  update(op: (doc: TreeDocument) => TreeDocument, coalesce?: string): void {
    this.commit(op(this._doc()), coalesce);
  }

  undo(): void {
    const entry = this.past.pop();
    if (!entry) return;
    this.future.push({ doc: this._doc(), selection: this.selection() });
    this._doc.set(entry.doc);
    this.selection.set(entry.selection);
    this.lastCoalesce = undefined;
    this.changed();
  }

  redo(): void {
    const entry = this.future.pop();
    if (!entry) return;
    this.past.push({ doc: this._doc(), selection: this.selection() });
    this._doc.set(entry.doc);
    this.selection.set(entry.selection);
    this.lastCoalesce = undefined;
    this.changed();
  }

  /** Opens a different tree. History starts over. */
  load(doc: TreeDocument): void {
    this._doc.set(doc);
    this.past = [];
    this.future = [];
    this.lastCoalesce = undefined;
    this.selection.set(null);
    this.loadId.update((v) => v + 1);
    this.changed();
  }

  selectPerson(id: string | null): void {
    this.selection.set(id ? { kind: 'person', id } : null);
  }

  selectFamily(id: string | null): void {
    this.selection.set(id ? { kind: 'family', id } : null);
  }

  private changed(): void {
    this.historyTick.update((v) => v + 1);
    this.revision.update((v) => v + 1);
    const s = this.selection();
    if (s?.kind === 'person' && !this.index().person(s.id)) this.selection.set(null);
    if (s?.kind === 'family' && !this.index().family(s.id)) this.selection.set(null);
  }
}
