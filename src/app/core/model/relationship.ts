import { Family, FamilyEnd, FamilyEndReason, FamilyKind, LifeEvent } from './types';

/**
 * The status of a couple as people talk about it. It is not stored directly:
 * it follows from the kind of family, the engagement and how it ended, which is
 * what the file format records.
 */
export type RelationshipStatus = 'married' | 'engaged' | 'partners' | 'separated' | 'divorced' | 'annulled' | 'widowed' | 'ended' | 'unknown';

export const RELATIONSHIP_STATUSES: readonly RelationshipStatus[] = [
  'married',
  'engaged',
  'partners',
  'separated',
  'divorced',
  'widowed',
  'annulled',
  'ended',
  'unknown',
];

const END_STATUS: Record<FamilyEndReason, RelationshipStatus> = {
  divorce: 'divorced',
  separation: 'separated',
  annulment: 'annulled',
  death: 'widowed',
  other: 'ended',
};

export function relationshipStatus(f: Pick<Family, 'kind' | 'engagement' | 'end'>): RelationshipStatus {
  if (f.end?.reason) return END_STATUS[f.end.reason];
  if (f.kind === 'marriage') return 'married';
  if (f.engagement) return 'engaged';
  if (f.kind === 'partnership') return 'partners';
  return 'unknown';
}

/** The relationship is over for a reason other than death. */
export function isBrokenUp(status: RelationshipStatus): boolean {
  return status === 'separated' || status === 'divorced' || status === 'annulled' || status === 'ended';
}

/** The couple were married at some point (so in-law words apply). */
export function wasMarried(f: Pick<Family, 'kind'>): boolean {
  return f.kind === 'marriage';
}

/** Statuses that come with an end date. */
export function hasEnd(status: RelationshipStatus): boolean {
  return status === 'separated' || status === 'divorced' || status === 'annulled' || status === 'widowed' || status === 'ended';
}

export interface StatusChange {
  kind: FamilyKind;
  engagement: LifeEvent | undefined;
  end: FamilyEnd | undefined;
}

/**
 * What to store for a chosen status. Dates and places already entered are kept
 * where they still make sense.
 */
export function statusChange(f: Pick<Family, 'kind' | 'engagement' | 'end'>, status: RelationshipStatus): StatusChange {
  const endWith = (reason: FamilyEndReason): FamilyEnd => ({ ...(f.end ?? {}), reason });
  switch (status) {
    case 'married':
      return { kind: 'marriage', engagement: f.engagement, end: undefined };
    case 'engaged':
      return { kind: 'partnership', engagement: f.engagement ?? {}, end: undefined };
    case 'partners':
      return { kind: 'partnership', engagement: undefined, end: undefined };
    case 'separated':
      return { kind: f.kind, engagement: f.engagement, end: endWith('separation') };
    case 'divorced':
      return { kind: 'marriage', engagement: f.engagement, end: endWith('divorce') };
    case 'annulled':
      return { kind: 'marriage', engagement: f.engagement, end: endWith('annulment') };
    case 'widowed':
      return { kind: f.kind === 'unknown' ? 'marriage' : f.kind, engagement: f.engagement, end: endWith('death') };
    case 'ended':
      return { kind: f.kind, engagement: f.engagement, end: endWith('other') };
    case 'unknown':
      return { kind: 'unknown', engagement: undefined, end: undefined };
  }
}
