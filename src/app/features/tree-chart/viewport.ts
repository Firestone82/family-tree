import { signal } from '@angular/core';
import { easeInOut } from './tween';

/** Where the chart is: an offset in screen pixels and a zoom factor. */
export interface View {
  x: number;
  y: number;
  k: number;
}

export const MIN_ZOOM = 0.12;
export const MAX_ZOOM = 2.5;

export function clampZoom(k: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));
}

/** Pan and zoom of the chart, with smooth moves when the person did not cause them directly. */
export class ChartViewport {
  readonly view = signal<View>({ x: 0, y: 0, k: 1 });
  private animation: number | null = null;

  constructor(private readonly reduceMotion: boolean) {}

  /** Moves the view, gliding there unless asked not to (or motion is reduced). */
  go(target: View, animate: boolean): void {
    this.stop();
    if (!animate || this.reduceMotion) {
      this.view.set(target);
      return;
    }
    const from = this.view();
    const start = performance.now();
    const duration = 420;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOut(t);
      this.view.set({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      this.animation = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.animation = requestAnimationFrame(step);
  }

  stop(): void {
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
  }

  /** Zooms by `factor`, keeping the point px,py (screen pixels) still. */
  zoomAt(factor: number, px: number, py: number, animate = false): void {
    const v = this.view();
    const k = clampZoom(v.k * factor);
    const wx = (px - v.x) / v.k;
    const wy = (py - v.y) / v.k;
    this.go({ x: px - wx * k, y: py - wy * k, k }, animate);
  }

  panBy(dx: number, dy: number): void {
    const v = this.view();
    this.view.set({ ...v, x: v.x - dx, y: v.y - dy });
  }

  /** Puts the chart point cx,cy in the middle of a screen area w×h at zoom k. */
  centreOn(cx: number, cy: number, k: number, w: number, h: number, animate: boolean): void {
    this.go({ x: w / 2 - cx * k, y: h / 2 - cy * k, k }, animate);
  }
}
