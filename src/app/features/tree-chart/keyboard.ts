/** Keys on the chart: zooming, showing everything, and moving between relatives with the arrows. */
import { LayoutCard } from '../../core/layout/layout-types';
import { TreeIndex } from '../../core/model/tree-index';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type ChartKey = { kind: 'zoom'; factor: number } | { kind: 'fit' } | { kind: 'move'; direction: Direction } | null;

const ARROWS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/** What a key press on the chart asks for; null for keys the chart leaves alone (and inside form fields). */
export function chartKey(e: KeyboardEvent): ChartKey {
  const target = e.target as Element | null;
  if (target?.closest?.('input, textarea, select, stemma-quick-add')) return null;
  if (e.key === '+' || e.key === '=') return { kind: 'zoom', factor: 1.25 };
  if (e.key === '-' || e.key === '_') return { kind: 'zoom', factor: 0.8 };
  if (e.key === '0' || e.key.toLowerCase() === 'f') return { kind: 'fit' };
  const direction = ARROWS[e.key];
  return direction ? { kind: 'move', direction } : null;
}

/** The person to move to: a parent going up, the nearest child going down, the row neighbour sideways. */
export function neighbour(index: TreeIndex, cards: readonly LayoutCard[], id: string, direction: Direction): string | undefined {
  const me = cards.find((c) => c.personId === id);
  if (!me) return undefined;
  if (direction === 'up') return index.parents(id)[0]?.id;
  if (direction === 'down') {
    const kids = index
      .children(id)
      .map((p) => cards.find((c) => c.personId === p.id))
      .filter((c): c is LayoutCard => !!c);
    kids.sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
    return kids[0]?.personId;
  }
  const row = cards.filter((c) => c.y === me.y).sort((a, b) => a.x - b.x);
  const i = row.findIndex((c) => c.personId === id);
  return (direction === 'left' ? row[i - 1] : row[i + 1])?.personId;
}
