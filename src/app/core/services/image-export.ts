import { Injectable } from '@angular/core';

/** Largest canvas drawn, in pixels: what phones (Safari on iOS) still accept. */
export const MAX_RASTER_PIXELS = 16_000_000;
const MAX_SIDE = 16_000;

/**
 * Turns a print (an SVG string) into files: SVG with the fonts inside it, and
 * PNG or JPEG images drawn at a chosen resolution.
 */
@Injectable({ providedIn: 'root' })
export class ImageExporter {
  /** The SVG with @font-face rules for the bundled fonts it uses, so it looks the same anywhere. */
  async withEmbeddedFonts(svg: string, text: string): Promise<string> {
    const css = await embeddedFonts(text, /font-style="italic"/.test(svg));
    if (!css) return svg;
    const at = svg.indexOf('>', svg.indexOf('<svg')) + 1;
    return svg.slice(0, at) + `<style>${css}</style>` + svg.slice(at);
  }

  /** Pixel size for drawing a page of `width` × `height` CSS pixels at `dpi`, within the canvas limits. */
  rasterSize(width: number, height: number, dpi: number): { w: number; h: number; dpi: number } {
    let scale = dpi / 96;
    scale = Math.min(scale, Math.sqrt(MAX_RASTER_PIXELS / (width * height)), MAX_SIDE / width, MAX_SIDE / height);
    return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)), dpi: Math.round(scale * 96) };
  }

  /** Draws an SVG (with fonts embedded) onto a canvas of the given pixel size. */
  async rasterize(svg: string, w: number, h: number, background = '#ffffff'): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      // Some browsers lay out the fonts in an SVG image a moment after it decodes.
      await new Promise((r) => setTimeout(r, 80));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot draw the image.');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  toBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be encoded.'))), type, quality));
  }
}

/** @font-face rules for the bundled faces covering the characters used, with the font data inlined. */
async function embeddedFonts(text: string, italic: boolean): Promise<string> {
  const wanted = new Set(['Alegreya Variable', 'Alegreya SC', 'Alegreya Sans']);
  const codepoints = new Set(Array.from(text).map((ch) => ch.codePointAt(0)!));
  codepoints.add(0x20);
  const rules: { rule: CSSFontFaceRule; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    const base = sheet.href ?? document.baseURI;
    const visit = (items: CSSRuleList) => {
      for (const r of Array.from(items)) {
        if (r instanceof CSSFontFaceRule) rules.push({ rule: r, base });
        else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) visit((r as CSSGroupingRule).cssRules);
      }
    };
    visit(list);
  }
  const out: string[] = [];
  const done = new Set<string>();
  for (const { rule, base } of rules) {
    const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
    if (!wanted.has(family)) continue;
    const style = rule.style.getPropertyValue('font-style') || 'normal';
    if (style === 'italic' && !italic) continue;
    const range = rule.style.getPropertyValue('unicode-range');
    if (range && !rangeCovers(range, codepoints)) continue;
    const src = rule.style.getPropertyValue('src');
    const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(src);
    if (!m) continue;
    const url = new URL(m[1], base).href;
    const weight = rule.style.getPropertyValue('font-weight') || '400';
    const key = `${family}|${style}|${weight}|${url}`;
    if (done.has(key)) continue;
    done.add(key);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = toBase64(await res.arrayBuffer());
      out.push(
        `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2");${range ? `unicode-range:${range};` : ''}}`,
      );
    } catch {
      // The export still works with fallback fonts.
    }
  }
  return out.join('\n');
}

function rangeCovers(range: string, codepoints: Set<number>): boolean {
  for (const part of range.split(',')) {
    const p = part.trim().toUpperCase().replace(/^U\+/, '');
    let lo: number;
    let hi: number;
    if (p.includes('?')) {
      lo = parseInt(p.replace(/\?/g, '0'), 16);
      hi = parseInt(p.replace(/\?/g, 'F'), 16);
    } else if (p.includes('-')) {
      const [a, b] = p.split('-');
      lo = parseInt(a, 16);
      hi = parseInt(b, 16);
    } else {
      lo = hi = parseInt(p, 16);
    }
    for (const cp of codepoints) if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
