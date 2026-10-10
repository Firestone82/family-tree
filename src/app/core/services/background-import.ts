/**
 * Turns a chosen file into a background picture that can live inside the XML
 * file. SVG stays a drawing, so it is sharp on any paper; JPEG, PNG and WebP
 * are kept as they are (very large ones are scaled down); the first page of a
 * PDF is drawn at about 6000 pixels, enough for A1 at 180 dpi.
 */
import { BackgroundImage } from '../model/types';

export type BackgroundProblem = 'unsupported' | 'empty' | 'pdf' | 'no-canvas';

/** A file that could not be used; `code` says why, for translation. */
export class BackgroundError extends Error {
  constructor(readonly code: BackgroundProblem) {
    super(code);
    this.name = 'BackgroundError';
  }
}

/** Longest side of a picture made from a PDF, and the most a photo is kept at. */
export const PICTURE_MAX_SIDE = 6000;
/** Canvas pixels the browser is asked for at most. */
const MAX_PIXELS = 32_000_000;

const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);
const BY_EXTENSION: Record<string, string> = {
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
};

/** The accept list for a file input. */
export const BACKGROUND_ACCEPT = '.svg,.pdf,.jpg,.jpeg,.png,.webp,.gif,.avif,image/svg+xml,application/pdf,image/jpeg,image/png,image/webp';

/** The type of a file, from the browser or else from its name. */
export function mediaTypeOf(file: Pick<File, 'type' | 'name'>): string {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  return file.type && file.type !== 'application/octet-stream' ? file.type : (BY_EXTENSION[ext] ?? '');
}

export async function backgroundFromFile(file: File): Promise<BackgroundImage> {
  const type = mediaTypeOf(file);
  let picture: Pick<BackgroundImage, 'href' | 'width' | 'height'>;
  if (type === 'image/svg+xml') picture = svgPicture(await file.text());
  else if (type === 'application/pdf') picture = await pdfPicture(await file.arrayBuffer());
  else if (RASTER.has(type)) picture = await rasterPicture(file, type);
  else throw new BackgroundError('unsupported');
  return { ...picture, fit: 'cover', opacity: 0.6, name: file.name };
}

// -- SVG ------------------------------------------------------------------------

const UNIT_PX: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

function length(value: string | null): number | undefined {
  const m = /^\s*([\d.]+)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(value ?? '');
  if (!m) return undefined;
  const v = Number(m[1]) * UNIT_PX[(m[2] ?? '').toLowerCase()];
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Makes an SVG safe and scalable: scripts and event handlers are dropped (they
 * would not run inside a picture anyway), and it gets a viewBox and a plain
 * size so it can be stretched to any paper without losing sharpness.
 */
export function normalizeSvg(text: string): { svg: string; width: number; height: number } {
  const dom = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = dom.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || dom.getElementsByTagName('parsererror').length) throw new BackgroundError('unsupported');
  for (const el of Array.from(root.querySelectorAll('script, foreignObject'))) el.remove();
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attr of Array.from(el.attributes)) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
  }
  const box = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  let width: number;
  let height: number;
  if (box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) {
    [width, height] = [box[2], box[3]];
  } else {
    width = length(root.getAttribute('width')) ?? 1000;
    height = length(root.getAttribute('height')) ?? 1000;
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  if (root.getAttribute('preserveAspectRatio') === 'none') root.removeAttribute('preserveAspectRatio');
  if (!root.childElementCount) throw new BackgroundError('empty');
  return { svg: new XMLSerializer().serializeToString(root), width, height };
}

function svgPicture(text: string): Pick<BackgroundImage, 'href' | 'width' | 'height'> {
  const { svg, width, height } = normalizeSvg(text);
  return { href: `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg))}`, width, height };
}

// -- photos -----------------------------------------------------------------------

async function rasterPicture(file: File, type: string): Promise<Pick<BackgroundImage, 'href' | 'width' | 'height'>> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new BackgroundError('unsupported');
    }
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) throw new BackgroundError('empty');
    const scale = Math.min(1, PICTURE_MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
    // Kept as it is unless it is huge, so nothing is lost.
    if (scale >= 1 && (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp')) {
      return { href: await dataUrl(file), width: w, height: h };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new BackgroundError('no-canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return { href: await dataUrl(await canvasBlob(canvas, out)), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// -- PDF --------------------------------------------------------------------------

/** The first page of a PDF, drawn at about PICTURE_MAX_SIDE pixels on a transparent ground. */
async function pdfPicture(bytes: ArrayBuffer): Promise<Pick<BackgroundImage, 'href' | 'width' | 'height'>> {
  let task: import('pdfjs-dist').PDFDocumentLoadingTask | undefined;
  try {
    // pdf.js is only loaded when someone picks a PDF. Its worker runs on the main thread here,
    // which is fine for drawing one page.
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs')]);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker ??= worker;
    task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: pdfjs.VerbosityLevel.ERRORS });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(PICTURE_MAX_SIDE / Math.max(base.width, base.height), Math.sqrt(MAX_PIXELS / (base.width * base.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    if (!canvas.getContext('2d')) throw new BackgroundError('no-canvas');
    await page.render({ canvas, viewport, background: 'rgba(0,0,0,0)' }).promise;
    return { href: await dataUrl(await canvasBlob(canvas, 'image/png')), width: canvas.width, height: canvas.height };
  } catch (e) {
    if (e instanceof BackgroundError) throw e;
    throw new BackgroundError('pdf');
  } finally {
    await task?.destroy();
  }
}

// -- helpers ----------------------------------------------------------------------

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new BackgroundError('no-canvas'))), type, type === 'image/jpeg' ? 0.9 : undefined),
  );
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new BackgroundError('unsupported'));
    reader.readAsDataURL(blob);
  });
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
