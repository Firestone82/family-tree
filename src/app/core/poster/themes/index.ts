/**
 * The print styles. To add one, write a PosterTheme (see heirloom.ts for a
 * complete example and poster-types.ts for what each part does) and add it to
 * this list. Its `id` is saved in the XML file; a file that names a style this
 * version does not have is printed with the first style and keeps the name.
 */
import { PosterTheme } from '../poster-types';
import { botanical } from './botanical';
import { heirloom } from './heirloom';
import { modern } from './modern';

export const POSTER_THEMES: readonly PosterTheme[] = [heirloom, botanical, modern];

export function posterTheme(id: string | undefined): PosterTheme {
  return POSTER_THEMES.find((t) => t.id === id) ?? POSTER_THEMES[0];
}
