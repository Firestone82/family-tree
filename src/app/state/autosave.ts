import { Injectable, effect, inject, untracked } from '@angular/core';
import { ToastService } from '../core/services/toast';
import { TreeStore } from '../core/store/tree-store';
import { serializeTree } from '../core/xml/serializer';
import { I18n } from '../i18n/i18n';

const TREE_KEY = 'stemma.tree.v1';
/** Left in localStorage when the tree is too big for it (a large background picture) and went to IndexedDB. */
const IN_DATABASE = '@indexeddb';
const DB_NAME = 'stemma';
const DB_STORE = 'autosave';

/**
 * Keeps a copy of the open tree in this browser, as the same XML the app
 * saves to files. Browser storage can be cleared at any time, so the XML file
 * is the real copy; this only spares people from losing work on a reload.
 *
 * The copy goes to localStorage, which is read at once on start. A tree that
 * does not fit there (a background picture can be several megabytes) goes to
 * IndexedDB instead, which holds much more but is read asynchronously.
 */
@Injectable({ providedIn: 'root' })
export class Autosave {
  private readonly store = inject(TreeStore);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private warned = false;
  private enabled = false;

  constructor() {
    effect(() => {
      this.store.revision();
      if (!untracked(() => this.enabled)) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.write(), 500);
    });
  }

  /** Starts saving after the first tree has been loaded. */
  enable(): void {
    this.enabled = true;
  }

  /** The saved tree: at once when it is in localStorage, later when it is in IndexedDB. */
  read(): string | Promise<string | null> | null {
    let saved: string | null;
    try {
      saved = localStorage.getItem(TREE_KEY);
    } catch {
      return null;
    }
    return saved === IN_DATABASE ? idbGet().catch(() => null) : saved;
  }

  flush(): void {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.write();
  }

  private write(): void {
    const xml = serializeTree(this.store.doc());
    try {
      localStorage.setItem(TREE_KEY, xml);
      void idbDelete().catch(() => undefined);
      return;
    } catch {
      // Too big for localStorage (or it is blocked): try IndexedDB.
    }
    idbPut(xml)
      .then(() => {
        try {
          localStorage.setItem(TREE_KEY, IN_DATABASE);
        } catch {
          // Without the marker the copy is not found again; the warning below covers it.
          throw new Error('marker');
        }
      })
      .catch(() => this.warn());
  }

  private warn(): void {
    if (this.warned) return;
    this.warned = true;
    this.toast.error(this.i18n.t('file.autosaveFailed'));
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no IndexedDB'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbRun<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const request = run(tx.objectStore(DB_STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const idbGet = () => idbRun<string | undefined>('readonly', (s) => s.get('tree')).then((v) => v ?? null);
const idbPut = (xml: string) => idbRun('readwrite', (s) => s.put(xml, 'tree')).then(() => undefined);
const idbDelete = () => idbRun('readwrite', (s) => s.delete('tree')).then(() => undefined);
