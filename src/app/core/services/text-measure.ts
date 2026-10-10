import { Injectable, signal } from '@angular/core';

/**
 * Measures text with the real fonts so chart labels can be shortened to fit.
 * SVG text does not wrap or truncate by itself.
 */
@Injectable({ providedIn: 'root' })
export class TextMeasurer {
  /** Changes when web fonts finish loading, so labels are measured again. */
  readonly fontsVersion = signal(0);
  private ctx: CanvasRenderingContext2D | null | undefined;
  private readonly cache = new Map<string, number>();

  constructor() {
    if (typeof document === 'undefined' || !document.fonts) return;
    const refresh = () => {
      this.cache.clear();
      this.fontsVersion.update((v) => v + 1);
    };
    document.fonts.ready.then(refresh).catch(() => undefined);
    document.fonts.addEventListener?.('loadingdone', refresh);
  }

  width(text: string, font: string): number {
    const key = `${font}|${text}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    if (this.ctx === undefined) {
      // jsdom (unit tests) has no canvas; estimate there instead.
      const noCanvas = typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent);
      try {
        this.ctx = noCanvas ? null : document.createElement('canvas').getContext('2d');
      } catch {
        this.ctx = null;
      }
    }
    let w: number;
    if (this.ctx) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
    } else {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
      w = text.length * size * 0.52;
    }
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(key, w);
    return w;
  }

  /** The text, shortened with an ellipsis when it is wider than `max`. */
  fit(text: string, font: string, max: number): string {
    if (!text || this.width(text, font) <= max) return text;
    const chars = Array.from(text);
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = chars.slice(0, mid).join('').trimEnd() + '…';
      if (this.width(candidate, font) <= max) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? chars.slice(0, lo).join('').trimEnd() + '…' : '…';
  }
}
