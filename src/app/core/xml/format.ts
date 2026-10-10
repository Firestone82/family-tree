/**
 * Stemma family tree XML format.
 *
 * Versioning (see docs/xml-format.md):
 * - `formatVersion="MAJOR.MINOR"` on the root element.
 * - A MINOR release only adds optional elements or attributes. Readers ignore what
 *   they do not know and keep it, so saving in an older app loses nothing.
 * - A MAJOR release may restructure the file. Newer apps read every older major
 *   version through the migrations in migrations.ts; older apps refuse newer
 *   major versions instead of guessing.
 * - The namespace never changes between versions.
 */
export const XML_NAMESPACE = 'urn:stemma:family-tree';
export const ROOT_ELEMENT = 'familyTree';

export const APP_NAME = 'Stemma';
export const APP_VERSION = '1.3.0';

export interface FormatVersion {
  major: number;
  minor: number;
}

/**
 * 1.0  First format.
 * 1.1  Adds <engagement> to <family>; showRelationships, showUnions and
 *      language to <view>; and <print> with print settings.
 * 1.2  Adds showSex, sexColors and showTree to <view> and <print>.
 * 1.3  Adds <background> (a picture behind the chart) and birthGroup on
 *      <child> (twins, triplets).
 */
export const CURRENT_FORMAT: FormatVersion = { major: 1, minor: 3 };

export function formatVersionString(v: FormatVersion = CURRENT_FORMAT): string {
  return `${v.major}.${v.minor}`;
}

/** Accepts "1", "1.0", "1.2" (and tolerates a patch part such as "1.2.3"). */
export function parseFormatVersion(text: string | null | undefined): FormatVersion | null {
  const m = /^\s*(\d+)(?:\.(\d+))?(?:\.\d+)?\s*$/.exec(text ?? '');
  if (!m) return null;
  return { major: Number(m[1]), minor: m[2] === undefined ? 0 : Number(m[2]) };
}

export function compareFormat(a: FormatVersion, b: FormatVersion): number {
  return a.major - b.major || a.minor - b.minor;
}

export const GENERATOR = `${APP_NAME} ${APP_VERSION}`;
