/**
 * The shape of translations. A message is text with {placeholders}, or a set
 * of plural forms picked by the {count} parameter with the language's plural
 * rules (English has one/other; Czech one/few/many/other).
 */
export interface PluralForms {
  /** Every language has this form; it is also the fallback. */
  other: string;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
}

export type Message = string | PluralForms;

export type MessageParams = Readonly<Record<string, string | number>>;

/** Fills in a message: picks the plural form for `count`, then replaces {name} with params.name. */
export function formatMessage(message: Message | undefined, params: MessageParams | undefined, plurals: Intl.PluralRules): string {
  if (message === undefined) return '';
  let text: string;
  if (typeof message === 'string') {
    text = message;
  } else {
    const form = plurals.select(Number(params?.['count'] ?? 0)) as keyof PluralForms;
    text = message[form] ?? message.other;
  }
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
