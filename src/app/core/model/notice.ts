/**
 * Something to tell the person: a stable code, the values to fill in, and the
 * English wording. The interface looks the code up in its own language and
 * falls back to the English text, so new messages work before they are
 * translated.
 */
export type NoticeParams = Readonly<Record<string, string | number>>;

export interface Notice {
  readonly code: string;
  readonly params: NoticeParams;
  readonly text: string;
}

export function notice(code: string, text: string, params: NoticeParams = {}): Notice {
  return { code, params, text };
}
