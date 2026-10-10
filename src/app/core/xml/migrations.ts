/**
 * Upgrades files written in an older MAJOR format version.
 *
 * Migrations work on the XML DOM before it is read into the model, so the reader
 * only ever has to understand the current format. Each migration upgrades one
 * major version and must set `formatVersion` on the root to the version it
 * produces. To introduce format 2.0:
 *
 *   1. Bump CURRENT_FORMAT in format.ts to { major: 2, minor: 0 }.
 *   2. Add `{ from: 1, to: '2.0', describe: '…', apply(doc) { … } }` below.
 *   3. Add a test that reads a 1.x file and checks the result.
 *
 * Minor versions never need a migration: they only add optional content.
 */
import { Notice, notice } from '../model/notice';
import { CURRENT_FORMAT, ROOT_ELEMENT } from './format';

export interface XmlMigration {
  /** The major version this migration reads. */
  from: number;
  /** The version it writes, e.g. "2.0". */
  to: string;
  /** Shown to the user after an upgrade (English). */
  describe: string;
  /** Code for translating `describe`; defaults to "upgrade.<from>". */
  code?: string;
  apply(doc: Document, warnings: Notice[]): void;
}

/** Format 1 is the first public format, so there is nothing to upgrade yet. */
export const MIGRATIONS: readonly XmlMigration[] = [];

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Applies migrations in sequence until the document reaches `targetMajor`.
 * Returns the descriptions of the migrations that ran.
 */
export function runMigrations(
  doc: Document,
  fromMajor: number,
  warnings: Notice[],
  migrations: readonly XmlMigration[] = MIGRATIONS,
  targetMajor: number = CURRENT_FORMAT.major,
): Notice[] {
  const applied: Notice[] = [];
  let major = fromMajor;
  while (major < targetMajor) {
    const step = migrations.find((m) => m.from === major);
    if (!step) {
      throw new MigrationError(`There is no upgrade path from file format ${major}.x. This file cannot be opened.`);
    }
    step.apply(doc, warnings);
    const root = doc.documentElement;
    if (root.localName !== ROOT_ELEMENT) throw new MigrationError(`Upgrade to ${step.to} produced an invalid file.`);
    root.setAttribute('formatVersion', step.to);
    applied.push(notice(step.code ?? `upgrade.${step.from}`, step.describe, { from: step.from, to: step.to }));
    const next = Number(step.to.split('.')[0]);
    if (!(next > major)) throw new MigrationError(`Upgrade from ${major}.x does not move to a newer version.`);
    major = next;
  }
  return applied;
}
