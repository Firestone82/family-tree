/** Message keys for values of the model, shared by the parts of the app that name them. */
import { RelationshipStatus } from '../core/model/relationship';
import { MessageKey } from './locales';

export const STATUS_LABEL: Record<RelationshipStatus, MessageKey> = {
  married: 'status.married',
  engaged: 'status.engaged',
  partners: 'status.partners',
  separated: 'status.separated',
  divorced: 'status.divorced',
  widowed: 'status.widowed',
  annulled: 'status.annulled',
  ended: 'status.ended',
  unknown: 'status.unknown',
};

/** "Twins", "Triplets"… for `count` children born together. */
export function bornTogetherLabel(t: (key: MessageKey) => string, count: number): string {
  const keys: Partial<Record<number, MessageKey>> = { 2: 'births.2', 3: 'births.3', 4: 'births.4', 5: 'births.5', 6: 'births.6' };
  return t(keys[count] ?? 'births.many');
}

/** "twin", "triplet"… for one of `count` children born together. */
export function bornTogetherTag(t: (key: MessageKey) => string, count: number): string {
  const keys: Partial<Record<number, MessageKey>> = { 2: 'births.one.2', 3: 'births.one.3', 4: 'births.one.4', 5: 'births.one.5', 6: 'births.one.6' };
  return t(keys[count] ?? 'births.one.many');
}
