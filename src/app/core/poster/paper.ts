/** Paper sizes for printing. Dimensions are portrait, in millimetres. */
export interface PaperSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAPERS: readonly PaperSize[] = [
  { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'A2', label: 'A2', widthMm: 420, heightMm: 594 },
  { id: 'A1', label: 'A1', widthMm: 594, heightMm: 841 },
  { id: 'A0', label: 'A0', widthMm: 841, heightMm: 1189 },
  { id: 'letter', label: 'US Letter', widthMm: 215.9, heightMm: 279.4 },
  { id: 'tabloid', label: 'Tabloid', widthMm: 279.4, heightMm: 431.8 },
];

/** A page exactly the size of the tree, for screens and print shops. */
export const FIT_PAPER = 'fit';

/** Page units are CSS pixels: 96 per inch. */
export const PX_PER_MM = 96 / 25.4;

/** The paper for a setting; papers this version does not know fall back to A3. */
export function paperSize(id: string): PaperSize | null {
  if (id === FIT_PAPER) return null;
  return PAPERS.find((p) => p.id.toLowerCase() === id.toLowerCase()) ?? PAPERS[1];
}
