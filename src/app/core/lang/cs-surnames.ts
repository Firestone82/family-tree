/**
 * Czech family names change with sex: Novák and Nováková, Mikula and Mikulová,
 * Černý and Černá, Marek and Marková. These rules give the feminine form of a
 * man's surname, and the likely masculine form of a woman's.
 */
import { Sex } from '../model/types';

const VOWEL = /[aáeéěiíoóuúůyý]/i;
/** Softened before ě: Vaněk gives Vaňková. */
const SOFTEN: Record<string, string> = { n: 'ň', d: 'ď', t: 'ť', N: 'Ň', D: 'Ď', T: 'Ť' };
const HARDEN: Record<string, string> = { ň: 'n', ď: 'd', ť: 't', Ň: 'N', Ď: 'D', Ť: 'T' };
/** Names that keep their e: Kadlec gives Kadlecová. */
const KEEPS_E = new Set(['kadlec', 'švec']);

/** Syllables, counting the syllabic r and l of names like Vlček and Krček. */
function syllables(word: string): number {
  const vowels = (word.match(/[aáeéěiíoóuúůyý]+/gi) ?? []).length;
  const syllabic = (word.match(/(?<=^|[^aáeéěiíoóuúůyý])[rl](?=[^aáeéěiíoóuúůyý]|$)/gi) ?? []).length;
  return vowels + syllabic;
}

function upper(word: string): boolean {
  return word === word.toLocaleUpperCase('cs') && word !== word.toLocaleLowerCase('cs');
}

/** Adds an ending in the same case as the word: NOVÁK gives NOVÁKOVÁ. */
function withEnding(stem: string, ending: string, like: string): string {
  return stem + (upper(like) ? ending.toLocaleUpperCase('cs') : ending);
}

/** The feminine form of one word of a surname. */
function feminineWord(word: string): string {
  const lower = word.toLocaleLowerCase('cs');
  if (word.length < 2) return word;
  // Already feminine, or the same for both (Krejčí, Janů).
  if (/(ová|á|í|ů)$/.test(lower)) return word;
  // Adjectives: Černý gives Černá.
  if (lower.endsWith('ý')) return withEnding(word.slice(0, -1), 'á', word);
  // Vowel endings drop the vowel: Mikula, Mikulová; Purkyně, Purkyňová.
  if (lower.endsWith('ě')) {
    const before = word.slice(-2, -1);
    return withEnding(word.slice(0, -2) + (SOFTEN[before] ?? before), 'ová', word);
  }
  if (/[aeo]$/.test(lower) && VOWEL.test(word.slice(0, -1))) return withEnding(word.slice(0, -1), 'ová', word);
  // The movable e of -ek, -ec and -el: Marek, Marková; Němec, Němcová; Havel, Havlová.
  const stem = word.slice(0, -2);
  const last = word.slice(-1);
  if (/[eě][kc]$/.test(lower) && !KEEPS_E.has(lower) && syllables(stem) >= 1) {
    const before = stem.slice(-1);
    const soft = lower.at(-2) === 'ě' ? (SOFTEN[before] ?? before) : before;
    return withEnding(stem.slice(0, -1) + soft + last, 'ová', word);
  }
  if (lower.endsWith('el') && syllables(word) === 2 && !VOWEL.test(stem.slice(-1))) return withEnding(stem + last, 'ová', word);
  return withEnding(word, 'ová', word);
}

/** The likely masculine form of one word of a feminine surname. */
function masculineWord(word: string): string {
  const lower = word.toLocaleLowerCase('cs');
  if (lower.endsWith('ová') && word.length > 4) {
    const stem = word.slice(0, -3);
    const s = stem.toLocaleLowerCase('cs');
    // Mikulová is most likely Mikula.
    if (s.endsWith('ul')) return withEnding(stem, 'a', word);
    // Put back a movable e: Marková, Marek; Vaňková, Vaněk; Němcová, Němec; Havlová, Havel.
    const m = /([^aáeéěiíoóuúůyý])([kc])$/i.exec(stem);
    if (m && syllables(stem.slice(0, -2)) >= 1) {
      const before = m[1];
      const hard = HARDEN[before];
      return hard ? stem.slice(0, -2) + hard + withEnding('', 'ě', word) + m[2] : stem.slice(0, -1) + withEnding('', 'e', word) + m[2];
    }
    if (/[^aáeéěiíoóuúůyý]l$/i.test(stem) && syllables(stem.slice(0, -1)) === 1) return stem.slice(0, -1) + withEnding('', 'e', word) + 'l';
    return stem;
  }
  // Adjectives: Černá gives Černý.
  if (lower.endsWith('á') && word.length > 3) return withEnding(word.slice(0, -1), 'ý', word);
  return word;
}

/**
 * Changes each word of a surname that is a name: the capitalised ones, so
 * "van der Berg" only changes "Berg" (every word when nothing is capitalised).
 */
function eachName(surname: string, change: (word: string) => string): string {
  const words = /\p{Lu}/u.test(surname) ? /\p{Lu}[\p{L}'’]*/gu : /\p{L}[\p{L}'’]*/gu;
  return surname.replace(words, (word) => change(word));
}

export function feminineSurname(surname: string): string {
  return eachName(surname.trim(), feminineWord);
}

/**
 * The masculine form of a surname. `known` are surnames of men in the same
 * tree: when one of them has `surname` as its feminine form it is used, since
 * the form alone cannot tell Mikulová (Mikula) from Nováková (Novák).
 */
export function masculineSurname(surname: string, known: readonly string[] = []): string {
  const text = surname.trim();
  const target = text.toLocaleLowerCase('cs');
  for (const m of known) {
    if (feminineSurname(m).toLocaleLowerCase('cs') === target) return m.trim();
  }
  return eachName(text, masculineWord);
}

/** A surname in the form for someone's sex, the Czech way. */
export function czechSurnameFor(surname: string, sex: Sex, known: readonly string[] = []): string {
  if (!surname.trim()) return surname;
  if (sex === 'female') return feminineSurname(surname);
  if (sex === 'male') return masculineSurname(surname, known);
  return surname.trim();
}
