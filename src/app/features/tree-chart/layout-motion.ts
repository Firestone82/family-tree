import { signal } from '@angular/core';
import { LayoutResult } from '../../core/layout/layout-types';
import { EMPTY_LAYOUT, anchorShift, easeInOut, lerpLayout } from './tween';
import { ChartViewport } from './viewport';

const GLIDE_MS = 380;

/**
 * The layout on screen. When the tree changes, the chart glides from the old
 * layout to the new one, and the view follows so the person being worked on
 * stays still under the pointer.
 */
export class LayoutMotion {
  /** The layout on screen; during a glide, a frame between two layouts. */
  readonly displayed = signal<LayoutResult>(EMPTY_LAYOUT);
  /** Set when the person moves the chart during a glide; the view then stops following. */
  userMoved = false;

  private frame: number | null = null;
  private lastLoadId = -1;

  constructor(
    private readonly viewport: ChartViewport,
    private readonly reduceMotion: boolean,
  ) {}

  /**
   * Shows `target`. Returns true when it belongs to a different tree than the
   * one on screen (a file was opened); the caller then frames it afresh.
   * `anchors` are the people to keep still, in order of preference.
   */
  show(target: LayoutResult, loadId: number, anchors: readonly string[]): boolean {
    const from = this.displayed();
    const reload = loadId !== this.lastLoadId || !from.cards.length;
    this.lastLoadId = loadId;
    this.stop();
    if (reload) {
      this.displayed.set(target);
      return true;
    }
    const shift = anchorShift(from, target, [...anchors]);
    const v0 = this.viewport.view();
    this.userMoved = false;
    if (this.reduceMotion) {
      this.displayed.set(target);
      this.viewport.view.set({ x: v0.x - shift.x * v0.k, y: v0.y - shift.y * v0.k, k: v0.k });
      return false;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const e = easeInOut(t);
      this.displayed.set(lerpLayout(from, target, e));
      if (!this.userMoved) this.viewport.view.set({ x: v0.x - shift.x * v0.k * e, y: v0.y - shift.y * v0.k * e, k: v0.k });
      this.frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
    return false;
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
