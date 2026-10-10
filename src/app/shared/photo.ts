export type PhotoProblem = 'not-image' | 'empty' | 'no-canvas';

/** A picture that could not be used; `code` says why, for translation. */
export class PhotoError extends Error {
  constructor(readonly code: PhotoProblem) {
    super(code);
    this.name = 'PhotoError';
  }
}

/**
 * Turns a picked image into a small square portrait (data: URL) suitable for
 * storing inside the XML file.
 */
export async function portraitFromFile(file: File, size = 240): Promise<string> {
  if (!file.type.startsWith('image/')) throw new PhotoError('not-image');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new PhotoError('empty');
    // Centre crop, biased up a little because faces sit high in most portraits.
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) / 2 - (img.naturalHeight - side) * 0.15);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoError('no-canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.84);
  } finally {
    URL.revokeObjectURL(url);
  }
}
