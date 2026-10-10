import { DateQualifier, GenDate, LifeEvent, Person } from './types';

const ISO_PARTIAL = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

/** Czech month names in the nominative ("květen 1923") and genitive ("17. května 1923"). */
const MONTHS_CS = [
  ['leden', 'ledna'],
  ['únor', 'února'],
  ['březen', 'března'],
  ['duben', 'dubna'],
  ['květen', 'května'],
  ['červen', 'června'],
  ['červenec', 'července'],
  ['srpen', 'srpna'],
  ['září', 'září'],
  ['říjen', 'října'],
  ['listopad', 'listopadu'],
  ['prosinec', 'prosince'],
];

const MONTH_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  MONTHS_LONG.forEach((name, i) => {
    map[name.toLowerCase()] = i + 1;
    map[name.slice(0, 3).toLowerCase()] = i + 1;
  });
  map['sept'] = 9;
  MONTHS_CS.forEach((names, i) => {
    for (const name of names) {
      map[name] = i + 1;
      map[stripMarks(name)] = i + 1;
    }
  });
  return map;
})();

/** Words in front of a date that make it approximate, in English and Czech. */
const QUALIFIER_WORDS: [RegExp, DateQualifier][] = [
  [/^(about|abt\.?|approximately|approx\.?|circa|ca\.?|c\.|~|asi|kolem|okolo|cca\.?|kol\.)\s*/i, 'about'],
  [/^(before|bef\.?|<|před|pred|př\.)\s*/i, 'before'],
  [/^(after|aft\.?|>|po(?=\s))\s*/i, 'after'],
  [/^(estimated|est\.?|odhadem|odh\.)\s*/i, 'estimated'],
  [/^(calculated|calc\.?|cal\.?|vypočteno|vypocteno|vyp\.)\s*/i, 'calculated'],
];

function stripMarks(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '');
}

function monthNumber(word: string): number | undefined {
  const key = word.toLowerCase();
  return MONTH_LOOKUP[key] ?? MONTH_LOOKUP[stripMarks(key)];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function compose(year: number, month?: number, day?: number): string | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
  const y = String(year).padStart(4, '0');
  if (month === undefined) return y;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (day === undefined) return `${y}-${pad2(month)}`;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) return null;
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

/** True when `value` is a valid 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' calendar date. */
export function isValidDateValue(value: string): boolean {
  const m = ISO_PARTIAL.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = m[2] === undefined ? undefined : Number(m[2]);
  const day = m[3] === undefined ? undefined : Number(m[3]);
  return compose(year, month, day) === value;
}

function parseCore(text: string): string | null {
  const s = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  let m: RegExpExecArray | null;

  // 1923 / 1923-05 / 1923-05-17 / 1923/5/17 / 1923.5.17
  if ((m = /^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?$/.exec(s))) {
    return compose(Number(m[1]), m[2] ? Number(m[2]) : undefined, m[3] ? Number(m[3]) : undefined);
  }
  // 17.5.1923 / 17. 5. 1923 / 17-05-1923 / 17/5/1923: day first, unless only month-first is a real date (5/17/1923)
  if ((m = /^(\d{1,2}) ?[./-] ?(\d{1,2}) ?[./-] ?(\d{4})$/.exec(s))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    return compose(year, b, a) ?? compose(year, a, b);
  }
  // 5.1923 / 5. 1923 / 05/1923
  if ((m = /^(\d{1,2}) ?[./-] ?(\d{4})$/.exec(s))) {
    return compose(Number(m[2]), Number(m[1]));
  }
  // 17 May 1923 / 17. May 1923 / 17. května 1923
  if ((m = /^(\d{1,2})\.?\s+(\p{L}+)\.?,?\s+(\d{4})$/iu.exec(s))) {
    const month = monthNumber(m[2]);
    return month ? compose(Number(m[3]), month, Number(m[1])) : null;
  }
  // May 17, 1923
  if ((m = /^(\p{L}+)\.?\s+(\d{1,2}),?\s+(\d{4})$/iu.exec(s))) {
    const month = monthNumber(m[1]);
    return month ? compose(Number(m[3]), month, Number(m[2])) : null;
  }
  // May 1923 / květen 1923
  if ((m = /^(\p{L}+)\.?,?\s+(\d{4})$/iu.exec(s))) {
    const month = monthNumber(m[1]);
    return month ? compose(Number(m[2]), month) : null;
  }
  return null;
}

/**
 * Reads a date the way people type it: "1923", "17.5.1923", "17 May 1923",
 * "May 1923", "abt 1923", "before 1900", "1923-05-17", and in Czech
 * "17. května 1923", "květen 1923", "asi 1900", "před 1850".
 * Returns undefined for empty input. Text that is not a date is kept as `text`.
 */
export function parseDateInput(input: string): GenDate | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  let rest = raw;
  let qualifier: DateQualifier | undefined;
  for (const [re, q] of QUALIFIER_WORDS) {
    const m = re.exec(rest);
    if (m) {
      qualifier = q;
      rest = rest.slice(m[0].length);
      break;
    }
  }
  const value = parseCore(rest);
  if (value) return qualifier ? { value, qualifier } : { value };
  return { value: '', text: raw };
}

const QUALIFIER_LONG: Record<DateQualifier, string> = {
  about: 'about',
  before: 'before',
  after: 'after',
  estimated: 'estimated',
  calculated: 'calculated',
};

const QUALIFIER_SHORT: Record<DateQualifier, string> = {
  about: 'c.',
  before: 'bef.',
  after: 'aft.',
  estimated: 'est.',
  calculated: 'calc.',
};

export function dateYear(date: GenDate | undefined): number | undefined {
  if (!date?.value) return undefined;
  const m = ISO_PARTIAL.exec(date.value);
  return m ? Number(m[1]) : undefined;
}

/** "17 May 1923", "about May 1923", "1923" or the original free text. */
export function formatDateLong(date: GenDate | undefined): string {
  if (!date) return '';
  if (!date.value) return date.text ?? '';
  const m = ISO_PARTIAL.exec(date.value);
  if (!m) return date.value;
  const [, y, mo, d] = m;
  let core = String(Number(y));
  if (mo && d) core = `${Number(d)} ${MONTHS_LONG[Number(mo) - 1]} ${core}`;
  else if (mo) core = `${MONTHS_LONG[Number(mo) - 1]} ${core}`;
  return date.qualifier ? `${QUALIFIER_LONG[date.qualifier]} ${core}` : core;
}

/** Compact form for the chart: "1923", "c. 1923", "bef. 1900". */
export function formatDateShort(date: GenDate | undefined): string {
  if (!date) return '';
  if (!date.value) return date.text ?? '';
  const year = dateYear(date);
  if (year === undefined) return date.value;
  return date.qualifier ? `${QUALIFIER_SHORT[date.qualifier]} ${year}` : String(year);
}

/** "17 May 1923" style with a 3-letter month, used in lists. */
export function formatDateMedium(date: GenDate | undefined): string {
  if (!date) return '';
  if (!date.value) return date.text ?? '';
  const m = ISO_PARTIAL.exec(date.value);
  if (!m) return date.value;
  const [, y, mo, d] = m;
  let core = String(Number(y));
  if (mo && d) core = `${Number(d)} ${MONTHS_SHORT[Number(mo) - 1]} ${core}`;
  else if (mo) core = `${MONTHS_SHORT[Number(mo) - 1]} ${core}`;
  return date.qualifier ? `${QUALIFIER_SHORT[date.qualifier]} ${core}` : core;
}

/** The value to show in a date text box, e.g. "17 May 1923" or "abt 1923". */
export function dateToInput(date: GenDate | undefined): string {
  if (!date) return '';
  if (!date.value) return date.text ?? '';
  return formatDateLong(date);
}

const THIN = ' ';
const EN_DASH = '–';

/**
 * Lifespan line for a person card: "1898 – 1971", "b. 1993", "† 1971", "1898 – †".
 */
export function lifespanLabel(person: Pick<Person, 'birth' | 'death'>): string {
  const born = formatDateShort(person.birth?.date);
  const died = formatDateShort(person.death?.date);
  const deceased = !!person.death;
  if (born && died) return `${born}${THIN}${EN_DASH}${THIN}${died}`;
  if (born && deceased) return `${born}${THIN}${EN_DASH}${THIN}†`;
  if (born) return `b. ${born}`;
  if (died) return `† ${died}`;
  if (deceased) return '†';
  return '';
}

/**
 * Sort key for chronological ordering. Missing month/day sort in the middle of
 * the year/month so a bare "1923" lands between January and December.
 */
export function dateSortKey(date: GenDate | undefined): number | undefined {
  if (!date?.value) return undefined;
  const m = ISO_PARTIAL.exec(date.value);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 6.5;
  const day = m[3] ? Number(m[3]) : 15.5;
  return year * 10000 + month * 100 + day;
}

export function eventSortKey(event: LifeEvent | undefined): number | undefined {
  return dateSortKey(event?.date);
}

/**
 * Age in whole years between two dates, when both have a year.
 * Returns `approximate: true` when month or day is missing or a qualifier is set.
 */
export function ageBetween(from: GenDate | undefined, to: GenDate | undefined): { years: number; approximate: boolean } | undefined {
  if (!from?.value || !to?.value) return undefined;
  const a = ISO_PARTIAL.exec(from.value);
  const b = ISO_PARTIAL.exec(to.value);
  if (!a || !b) return undefined;
  let years = Number(b[1]) - Number(a[1]);
  const exact = !!(a[2] && a[3] && b[2] && b[3]) && !from.qualifier && !to.qualifier;
  if (a[2] && b[2]) {
    const am = Number(a[2]);
    const bm = Number(b[2]);
    if (bm < am || (bm === am && a[3] && b[3] && Number(b[3]) < Number(a[3]))) years -= 1;
  }
  if (years < 0) return undefined;
  return { years, approximate: !exact };
}

/** Today's date as a GenDate, for ages of living people. */
export function todayDate(now = new Date()): GenDate {
  return { value: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}` };
}

export function describeDateInput(input: string): string {
  const parsed = parseDateInput(input);
  if (!parsed) return '';
  if (!parsed.value) return 'Kept as written (not a recognised date)';
  return formatDateLong(parsed);
}
