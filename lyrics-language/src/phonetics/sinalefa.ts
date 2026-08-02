import { classifyVowelChar } from './spanish-vowels.js';

/**
 * Whether the word's last sound is a vowel. A final `y` counts ("hoy", "ley",
 * "muy"): orthography aside, it is the semivowel /i/.
 */
function endsInVowelSound(word: string): boolean {
    const last = word.at(-1);
    if (last === undefined) {
        return false;
    }
    return classifyVowelChar(last) !== null || last.toLowerCase() === 'y';
}

/**
 * Whether the word's first sound is a vowel. Two special cases:
 * - a silent `h` doesn't block it ("hora", "hierba" open on a vowel);
 * - a leading `y` is the consonant /ʝ/ ("yo", "ya") EXCEPT when the whole word
 *   is the conjunction "y", which is the vowel /i/.
 */
function startsWithVowelSound(word: string): boolean {
    const first = word[0];
    if (first === undefined) {
        return false;
    }
    if (word.toLowerCase() === 'y') {
        return true;
    }
    if (classifyVowelChar(first) !== null) {
        return true;
    }
    return first.toLowerCase() === 'h' && word.length > 1 && classifyVowelChar(word[1]) !== null;
}

/**
 * Whether a sinalefa is even possible between two adjacent words — i.e.
 * whether a vowel sound meets a vowel sound across the boundary. Only such a
 * boundary is alterable; every other one is written as a plain space and can
 * never be fused (see `WordNode.trailingJoin`).
 *
 * This is a phonetic *possibility* check, not a decision: whether the sinalefa
 * is actually applied is the author's call, expressed with `&`/`|`.
 */
export function canSinalefa(previous: string, next: string): boolean {
    return endsInVowelSound(previous) && startsWithVowelSound(next);
}
