/** Small helpers for writing SVG markup as strings. */
import { escapeAttr, escapeText } from '../xml/xml-writer';
import { FontSpec } from './poster-types';

export type AttrValue = string | number | undefined | null | false;

export function n(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function attrs(a: Record<string, AttrValue>): string {
  let out = '';
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === null || v === false || v === '') continue;
    out += ` ${k}="${escapeAttr(typeof v === 'number' ? n(v) : v)}"`;
  }
  return out;
}

export function el(tag: string, a: Record<string, AttrValue> = {}, children?: string): string {
  return children === undefined || children === '' ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${children}</${tag}>`;
}

export function text(t: string): string {
  return escapeText(t);
}

/** SVG attributes for a font. */
export function fontAttrs(f: FontSpec): Record<string, AttrValue> {
  return {
    'font-family': f.family,
    'font-size': f.size,
    'font-weight': f.weight && f.weight !== 400 ? f.weight : undefined,
    'font-style': f.style === 'italic' ? 'italic' : undefined,
    'letter-spacing': f.letterSpacing ? n(f.letterSpacing * f.size) : undefined,
  };
}

/** A canvas font shorthand for measuring. */
export function cssFont(f: FontSpec): string {
  return `${f.style === 'italic' ? 'italic ' : ''}${f.weight ?? 400} ${f.size}px ${f.family}`;
}

/** A heater shield, flat on top and curving to a point. */
export function shieldPath(w: number, h: number): string {
  const side = h * 0.42;
  return `M0,0H${n(w)}V${n(side)}C${n(w)},${n(h * 0.74)} ${n(w * 0.74)},${n(h * 0.92)} ${n(w / 2)},${n(h)}C${n(w * 0.26)},${n(h * 0.92)} 0,${n(h * 0.74)} 0,${n(side)}Z`;
}

/** Deterministic random numbers, so a print looks the same every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A tile of faint specks for paper texture. */
export function specklePattern(id: string, size: number, color: string, count: number, seed: number, maxR = 0.7, opacity = 0.25): string {
  const rnd = seededRandom(seed);
  let dots = '';
  for (let i = 0; i < count; i++) {
    const r = 0.2 + rnd() * maxR;
    dots += `<circle cx="${n(rnd() * size)}" cy="${n(rnd() * size)}" r="${n(r)}" fill-opacity="${n(opacity * (0.4 + rnd() * 0.6))}"/>`;
  }
  return `<pattern id="${id}" width="${n(size)}" height="${n(size)}" patternUnits="userSpaceOnUse"><g fill="${escapeAttr(color)}">${dots}</g></pattern>`;
}

/** A colour between two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, shift: number) => (p >> shift) & 255;
  const mix = (shift: number) => Math.round(ch(pa, shift) + (ch(pb, shift) - ch(pa, shift)) * t);
  return `#${((1 << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).slice(1)}`;
}
