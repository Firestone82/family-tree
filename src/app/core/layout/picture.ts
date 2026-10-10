/** Placing a picture of known size in an area, the way CSS object-fit does. */
import { BackgroundFit } from '../model/types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The box the picture is drawn in, keeping its proportions: `cover` fills the
 * area and sticks out of it on two sides (to be clipped), `contain` shows all
 * of it inside the area. Working the box out here, rather than leaving it to
 * preserveAspectRatio, gives the same result for SVG and photos, in browsers
 * and in other programs that open the exported SVG.
 */
export function pictureBox(area: Box, picture: { width: number; height: number; fit: BackgroundFit }): Box {
  const pw = picture.width > 0 ? picture.width : area.w;
  const ph = picture.height > 0 ? picture.height : area.h;
  const sx = area.w / pw;
  const sy = area.h / ph;
  const s = picture.fit === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
  const w = pw * s;
  const h = ph * s;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}
