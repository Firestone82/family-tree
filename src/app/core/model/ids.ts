/** Ids must be valid XML NCNames so the file validates against the schema (xs:ID). */
export const ID_PATTERN = /^[A-Za-z_][A-Za-z0-9._-]*$/;

function randomChunk(length: number): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** A short random id such as "I3k9x2a", unique among `taken`. */
export function newId(prefix: 'I' | 'F', taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `${prefix}${randomChunk(6)}`;
    if (!taken.has(id)) return id;
  }
}

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}
