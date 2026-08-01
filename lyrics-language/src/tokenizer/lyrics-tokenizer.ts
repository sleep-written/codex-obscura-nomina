import { Tokenizer } from './tokenizer.js';
import type { TokenFactory } from './interfaces/index.js';

const isLetter = (v: string): boolean => /\p{L}/u.test(v);
const isSpace = (v: string): boolean => v === ' ';
const isNewline = (v: string): boolean => v === '\n';
const isSymbol = (v: string): boolean => (
    v === '-' || v === '&' ||
    v === '+' || v === '_' ||
    v === '%' || v === '/' ||
    v === '#'
);

/**
 * Builds a {@link TokenFactory} that greedily consumes every consecutive
 * character matched by `test`, and is also satisfied by end of input.
 */
function classFactory(test: (v: string) => boolean): TokenFactory {
    return {
        close: next => typeof next !== 'string' || test(next)
    };
}

/**
 * Token factories for the `.lyrics` format, as defined in `./MEMORY.md`:
 * - ` ` (space) separates words and implies sinalefa deactivated.
 * - `-` separates syllables.
 * - `&` activates sinalefa (replaces the space between the two fused words).
 * - `+` / `_` activate/deactivate diéresis.
 * - `%` / `/` activate/deactivate sinéresis.
 * - `#` marks a stanza title.
 * - `\n` ends a verse; `\n{2,}` ends a stanza.
 */
export const lyricsTokenFactories = {
    text: classFactory(isLetter),
    'word-separator': classFactory(isSpace),
    'syllable-separator': classFactory(v => v === '-'),

    sinalefa: classFactory(v => v === '&'),
    'diaeresis-on': classFactory(v => v === '+'),
    'diaeresis-off': classFactory(v => v === '_'),
    'synaeresis-on': classFactory(v => v === '%'),
    'synaeresis-off': classFactory(v => v === '/'),
    'stanza-title': classFactory(v => v === '#'),

    'verse-end': {
        close: (next?: string) => typeof next !== 'string' || isNewline(next),
        hold: (acum: string) => acum.length === 1
    },
    'stanza-end': {
        close: (next?: string) => typeof next !== 'string' || isNewline(next),
        hold: (acum: string) => acum.length >= 2
    },

    unknown: classFactory(v => !isLetter(v) && !isSpace(v) && !isNewline(v) && !isSymbol(v))
} as const satisfies Record<string, TokenFactory>;

export type LyricsTokenType = keyof typeof lyricsTokenFactories;

export const lyricsTokenizer = new Tokenizer(lyricsTokenFactories);
