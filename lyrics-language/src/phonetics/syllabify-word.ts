import { classifyVowelChar, classifyVowelPair } from './spanish-vowels.js';
import type { VowelInfo } from './spanish-vowels.js';

export interface MarkerEvent {
    /** 0-based offset into `Array.from(word.normalize('NFC'))`, right before the letter it precedes. */
    offset: number;
    kind: 'syllable-separator' | 'diaeresis-off' | 'synaeresis-off';
}

interface LetterInfo {
    char: string;
    /** `null` for consonants, and for a `u` silenced by a preceding `g`/`q` before `e`/`i`. */
    vowel: VowelInfo | null;
    /** `h` sitting between two real vowels (not part of a `ch` digraph) — transparent to vowel adjacency. */
    isTransparentH: boolean;
}

const DIGRAPHS = new Set(['ch', 'll', 'rr']);
const INSEPARABLE_PAIRS = new Set([
    'pr', 'br', 'tr', 'dr', 'cr', 'gr', 'fr',
    'pl', 'bl', 'cl', 'gl', 'fl'
]);

function analyzeLetters(chars: string[]): LetterInfo[] {
    const letters: LetterInfo[] = chars.map(char => ({
        char,
        vowel: classifyVowelChar(char),
        isTransparentH: false
    }));

    // Silence a 'u' that follows 'g'/'q' before 'e'/'i' ("gue", "gui", "que", "qui").
    // A 'ü' is never silenced — classifyVowelChar already keeps it separate from plain 'u'.
    for (let i = 0; i < letters.length; i++) {
        if (letters[i].char.toLowerCase() !== 'u' || letters[i].vowel === null) {
            continue;
        }
        const prev = letters[i - 1]?.char.toLowerCase();
        const next = letters[i + 1]?.char.toLowerCase();
        if ((prev === 'g' || prev === 'q') && (next === 'e' || next === 'é' || next === 'i' || next === 'í')) {
            letters[i].vowel = null;
        }
    }

    // A single 'h' between two real vowels is transparent to their adjacency, UNLESS it's
    // the second half of a "ch" digraph (a consonant sound, not a silent letter).
    for (let i = 0; i < letters.length; i++) {
        if (letters[i].char.toLowerCase() !== 'h') {
            continue;
        }
        const prevIsC = letters[i - 1]?.char.toLowerCase() === 'c';
        const prevVowel = letters[i - 1]?.vowel;
        const nextVowel = letters[i + 1]?.vowel;
        if (!prevIsC && prevVowel != null && nextVowel != null) {
            letters[i].isTransparentH = true;
        }
    }

    // A word-final 'y' right after a vowel acts as a weak vowel ("hoy", "voy", "rey", "muy").
    const last = letters[letters.length - 1];
    const secondLast = letters[letters.length - 2];
    if (last && last.char.toLowerCase() === 'y' && secondLast?.vowel != null) {
        last.vowel = { strength: 'weak', accented: false };
    }

    return letters;
}

/** Maximal runs of core-vowel indices, bridged over any transparent 'h' between them. */
function findVowelRuns(letters: LetterInfo[]): number[][] {
    const runs: number[][] = [];
    let current: number[] = [];

    for (let i = 0; i < letters.length; i++) {
        const isRunChar = letters[i].vowel !== null || letters[i].isTransparentH;
        if (isRunChar) {
            if (letters[i].vowel !== null) {
                current.push(i);
            }
        } else if (current.length > 0) {
            runs.push(current);
            current = [];
        }
    }
    if (current.length > 0) {
        runs.push(current);
    }

    return runs;
}

/** Splits a consonant gap (between two vowel runs) into syllabification units. */
function tokenizeConsonantUnits(letters: LetterInfo[], start: number, end: number): { start: number; length: number }[] {
    const units: { start: number; length: number }[] = [];
    let i = start;

    while (i < end) {
        const c0 = letters[i].char.toLowerCase();
        const c1 = i + 1 < end ? letters[i + 1].char.toLowerCase() : undefined;

        if (c1 !== undefined && DIGRAPHS.has(c0 + c1)) {
            units.push({ start: i, length: 2 });
            i += 2;
            continue;
        }
        if (c1 === 'u' && (c0 === 'g' || c0 === 'q') && letters[i + 1].vowel === null) {
            units.push({ start: i, length: 2 });
            i += 2;
            continue;
        }
        units.push({ start: i, length: 1 });
        i += 1;
    }

    return units;
}

/**
 * Classic Spanish consonant-cluster rule: a lone consonant goes with the
 * following vowel; with two or more, the boundary sits before the last unit,
 * unless the last two units are single letters forming an inseparable group
 * (`pr`, `bl`, ...), in which case both go with the following vowel.
 */
function gapBoundaryOffset(letters: LetterInfo[], units: { start: number; length: number }[]): number {
    if (units.length === 1) {
        return units[0].start;
    }

    const [penultimate, last] = units.slice(-2);
    if (penultimate.length === 1 && last.length === 1) {
        const pair = (letters[penultimate.start].char + letters[last.start].char).toLowerCase();
        if (INSEPARABLE_PAIRS.has(pair)) {
            return penultimate.start;
        }
    }

    return last.start;
}

/**
 * Computes the Spanish syllable boundaries of a single word (letters only,
 * no DSL symbols), as a sequence of {@link MarkerEvent}s describing where and
 * how each boundary should be marked if the word were annotated by hand:
 * `syllable-separator` for a plain consonant break, `diaeresis-off` for a
 * natural diphthong (kept together, marked but not split), `synaeresis-off`
 * for a natural hiato (split, marked as such). Returns `[]` for a word with
 * no vowels (a single, unsplit syllable).
 *
 * Not covered (documented limitation, not a bug): true triphthongs (e.g.
 * "buey") still yield the correct syllable text and count, but only the
 * later of their two internal vowel-pair events survives translation into
 * the AST, since {@link SyllableNode.internalMarker} is singular.
 */
export function syllabifyWord(word: string): MarkerEvent[] {
    const letters = analyzeLetters(Array.from(word.normalize('NFC')));
    const runs = findVowelRuns(letters);
    const events: MarkerEvent[] = [];

    for (const run of runs) {
        for (let j = 0; j < run.length - 1; j++) {
            const a = letters[run[j]].vowel!;
            const b = letters[run[j + 1]].vowel!;
            events.push({
                offset: run[j] + 1,
                kind: classifyVowelPair(a, b) === 'hiato' ? 'synaeresis-off' : 'diaeresis-off'
            });
        }
    }

    for (let r = 0; r < runs.length - 1; r++) {
        const gapStart = runs[r][runs[r].length - 1] + 1;
        const gapEnd = runs[r + 1][0];
        const units = tokenizeConsonantUnits(letters, gapStart, gapEnd);
        events.push({ offset: gapBoundaryOffset(letters, units), kind: 'syllable-separator' });
    }

    return events.sort((x, y) => x.offset - y.offset);
}
