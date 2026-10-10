import { signal } from '@angular/core';
import { ChartViewport, View, clampZoom } from './viewport';

const DRAG_THRESHOLD = 5;

type Gesture =
  | { kind: 'pan'; id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'pinch'; d0: number; k0: number; mx: number; my: number; vx: number; vy: number };

/**
 * Dragging, pinching and wheel zooming on the chart. A drag that moved does not
 * count as a click, so letting go over a card does not select it.
 */
export class ChartGestures {
  readonly panning = signal(false);
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: Gesture | null = null;
  private suppressClick = false;

  constructor(
    private readonly viewport: ChartViewport,
    private readonly surface: () => SVGSVGElement,
    /** Called when the person moves the chart themselves. */
    private readonly onUserMove: () => void,
  ) {}

  /** True (once) when the click that follows a drag should be ignored. */
  swallowClick(): boolean {
    if (!this.suppressClick) return false;
    this.suppressClick = false;
    return true;
  }

  down(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.viewport.stop();
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const v = this.viewport.view();
    if (this.pointers.size === 1) {
      this.gesture = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: v.k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: v.x, vy: v.y };
      this.capture(e.pointerId);
      this.start();
    }
  }

  move(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    const g = this.gesture;
    if (!p || !g) return;
    Object.assign(p, this.local(e));
    if (g.kind === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const k = clampZoom((g.k0 * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / g.d0);
      const wx = (g.mx - g.vx) / g.k0;
      const wy = (g.my - g.vy) / g.k0;
      this.viewport.view.set({ x: (a.x + b.x) / 2 - wx * k, y: (a.y + b.y) / 2 - wy * k, k });
      return;
    }
    if (g.kind === 'pan' && g.id === e.pointerId) {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        g.moved = true;
        this.capture(e.pointerId);
        this.start();
      }
      if (g.moved) this.viewport.view.set({ x: g.vx + dx, y: g.vy + dy, k: this.viewport.view().k });
    }
  }

  up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g && (g.kind === 'pinch' || g.moved)) {
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false), 50);
    }
    if (this.pointers.size === 1 && g?.kind === 'pinch') {
      // Lifting one finger of a pinch carries on as a drag with the other.
      const [id, p] = [...this.pointers.entries()][0];
      const rect = this.surface().getBoundingClientRect();
      const v: View = this.viewport.view();
      this.gesture = { kind: 'pan', id, sx: p.x + rect.left, sy: p.y + rect.top, vx: v.x, vy: v.y, moved: true };
      return;
    }
    if (!this.pointers.size) {
      this.gesture = null;
      this.panning.set(false);
    }
  }

  /** Scrolling pans; a mouse wheel, Ctrl+scroll and trackpad pinch zoom. */
  wheel(e: WheelEvent): void {
    e.preventDefault();
    this.viewport.stop();
    this.onUserMove();
    const { x: px, y: py } = this.local(e);
    const lineScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * lineScale;
    const dy = e.deltaY * lineScale;
    const mouseWheel = e.deltaMode !== 0 || (dx === 0 && Math.abs(dy) >= 50 && Number.isInteger(dy));
    if (e.ctrlKey || e.metaKey) this.viewport.zoomAt(Math.exp(-dy * 0.01), px, py);
    else if (mouseWheel) this.viewport.zoomAt(Math.exp(-dy * 0.0016), px, py);
    else this.viewport.panBy(dx, dy);
  }

  private start(): void {
    this.panning.set(true);
    this.onUserMove();
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.surface().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private capture(pointerId: number): void {
    try {
      this.surface().setPointerCapture(pointerId);
    } catch {
      // Capture is an optimisation; dragging works without it.
    }
  }
}
