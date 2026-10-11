/**
 * Changes made by hand to the automatic layout (see Arrangement in types.ts):
 * couples moved sideways, family lines moved up or down, couples turned round.
 * Pure functions over documents, like the other edits, so they can be undone.
 */
import { Arrangement, TreeDocument } from './types';

const EMPTY: Arrangement = { moves: {}, lines: {}, left: {} };

/** Moves smaller than this are no move at all. */
const NOTHING = 0.5;

/** The arrangement of a tree, without entries for people and families that are no longer in it. */
export function arrangementOf(doc: TreeDocument): Arrangement {
  const a = doc.arrangement;
  if (!a) return EMPTY;
  const people = new Set(doc.people.map((p) => p.id));
  const families = new Map(doc.families.map((f) => [f.id, f]));
  const moves = Object.fromEntries(Object.entries(a.moves).filter(([id]) => people.has(id)));
  const lines = Object.fromEntries(Object.entries(a.lines).filter(([id]) => families.has(id)));
  const left = Object.fromEntries(
    Object.entries(a.left).filter(([id, p]) => families.get(id)?.partners.length === 2 && families.get(id)!.partners.includes(p)),
  );
  return { moves, lines, left, ...(a.ext ? { ext: a.ext } : {}) };
}

/** Whether anything in the tree's layout was changed by hand. */
export function isArranged(doc: TreeDocument): boolean {
  const a = arrangementOf(doc);
  return Object.keys(a.moves).length + Object.keys(a.lines).length + Object.keys(a.left).length > 0;
}

/** Moves people's cards sideways by `dx`, on top of earlier moves. */
export function moveCards(doc: TreeDocument, personIds: readonly string[], dx: number): TreeDocument {
  const a = arrangementOf(doc);
  const moves = { ...a.moves };
  for (const id of personIds) set(moves, id, (moves[id] ?? 0) + dx);
  return withArrangement(doc, { ...a, moves });
}

/** Moves a family's line down by `dy` (up when negative), on top of earlier moves. */
export function moveLine(doc: TreeDocument, familyId: string, dy: number): TreeDocument {
  const a = arrangementOf(doc);
  const lines = { ...a.lines };
  set(lines, familyId, (lines[familyId] ?? 0) + dy);
  return withArrangement(doc, { ...a, lines });
}

/** Draws `personId` on the left of their partner in `familyId`. */
export function setLeftPartner(doc: TreeDocument, familyId: string, personId: string): TreeDocument {
  const a = arrangementOf(doc);
  return withArrangement(doc, { ...a, left: { ...a.left, [familyId]: personId } });
}

/** Puts people's cards back where the layout puts them. */
export function resetCards(doc: TreeDocument, personIds: readonly string[]): TreeDocument {
  const a = arrangementOf(doc);
  const moves = { ...a.moves };
  for (const id of personIds) delete moves[id];
  return withArrangement(doc, { ...a, moves });
}

/** Puts a family's line back where the layout puts it. */
export function resetLine(doc: TreeDocument, familyId: string): TreeDocument {
  const a = arrangementOf(doc);
  const lines = { ...a.lines };
  delete lines[familyId];
  return withArrangement(doc, { ...a, lines });
}

/** Back to the automatic layout everywhere. */
export function resetArrangement(doc: TreeDocument): TreeDocument {
  return withArrangement(doc, EMPTY);
}

function set(record: Record<string, number>, key: string, value: number): void {
  const v = Math.round(value * 10) / 10;
  if (Math.abs(v) < NOTHING) delete record[key];
  else record[key] = v;
}

function withArrangement(doc: TreeDocument, a: Arrangement): TreeDocument {
  const empty = !Object.keys(a.moves).length && !Object.keys(a.lines).length && !Object.keys(a.left).length && !a.ext;
  if (empty) {
    if (!doc.arrangement) return doc;
    const next = { ...doc };
    delete next.arrangement;
    return next;
  }
  return { ...doc, arrangement: a };
}
