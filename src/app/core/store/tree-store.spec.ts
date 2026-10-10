import { TestBed } from '@angular/core/testing';
import { addPerson, updatePerson } from '../model/operations';
import { emptyDocument } from '../model/types';
import { TreeStore } from './tree-store';

describe('TreeStore', () => {
  let store: TreeStore;

  beforeEach(() => {
    store = TestBed.inject(TreeStore);
    store.load(emptyDocument('Test'));
  });

  it('undoes and redoes edits', () => {
    const { personId } = store.apply((doc) => addPerson(doc, { given: 'Ada' }));
    expect(store.doc().people).toHaveLength(1);
    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.doc().people).toHaveLength(0);
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.doc().people[0].id).toBe(personId);
  });

  it('merges quick typing in one field into a single undo step', () => {
    const { personId } = store.apply((doc) => addPerson(doc, { given: '' }));
    for (const value of ['A', 'Ad', 'Ada']) {
      store.update((doc) => updatePerson(doc, personId, { name: { given: value } }), `person:${personId}:given`);
    }
    expect(store.doc().people[0].name.given).toBe('Ada');
    store.undo();
    expect(store.doc().people[0].name.given).toBe('');
    store.undo();
    expect(store.doc().people).toHaveLength(0);
  });

  it('drops a selection whose person no longer exists', () => {
    const { personId } = store.apply((doc) => addPerson(doc, { given: 'Ada' }));
    store.selectPerson(personId);
    expect(store.selectedPerson()?.name.given).toBe('Ada');
    store.undo();
    expect(store.selection()).toBeNull();
  });

  it('starts history over when another tree is opened', () => {
    store.apply((doc) => addPerson(doc, { given: 'Ada' }));
    const before = store.loadId();
    store.load(emptyDocument('Other'));
    expect(store.canUndo()).toBe(false);
    expect(store.loadId()).toBe(before + 1);
  });

  it('stamps the modified time on edits', () => {
    store.apply((doc) => addPerson(doc, { given: 'Ada' }));
    expect(Date.parse(store.doc().meta.modified!)).toBeGreaterThan(0);
  });
});
