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
 * Matches a `//`-prefixed comment that runs until (but excluding) the next
 * `\n` or end of input. Needs instance state because it requires a literal
 * 2-character prefix, which a single-character `classFactory` predicate
 * can't express without colliding with the lone `/` used by `synaeresis-off`.
 *
 * Safe as instance state: the engine only calls `close` again for a factory
 * once it has been dropped from the previous token attempt, so every call
 * sequence that reaches `#step` back to `0` is guaranteed to be the first
 * character of a brand new token attempt.
 */
class CommentFactory implements TokenFactory {
    #step = 0;

    close(next?: string): boolean {
        if (typeof next !== 'string') {
            this.#step = 0;
            return false;
        }

        if (this.#step === 0) {
            if (next === '/') {
                this.#step = 1;
                return true;
            }
            return false;
        }

        if (this.#step === 1) {
            if (next === '/') {
                this.#step = 2;
                return true;
            }
            this.#step = 0;
            return false;
        }

        if (next === '\n') {
            this.#step = 0;
            return false;
        }
        return true;
    }
}

/**
 * Token factories for the `.lyrics` format, as defined in `./MEMORY.md`:
 * - ` ` (space) separates words and implies sinalefa deactivated.
 * - `-` separates syllables.
 * - `&` activates sinalefa (replaces the space between the two fused words).
 * - `+` / `_` activate/deactivate diéresis.
 * - `%` / `/` activate/deactivate sinéresis.
 * - `#` marks a song title; `##` (or more) marks a stanza title.
 * - `//` starts a comment that runs until the next `\n`.
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

    'song-title-marker': {
        close: (next?: string) => next === '#',
        hold: (acum: string) => acum.length === 1
    },
    'stanza-title-marker': {
        close: (next?: string) => next === '#',
        hold: (acum: string) => acum.length >= 2
    },

    comment: CommentFactory,

    'verse-end': {
        close: (next?: string) => typeof next !== 'string' || isNewline(next),
        hold: (acum: string) => acum.length === 1
    },
    'stanza-end': {
        close: (next?: string) => typeof next !== 'string' || isNewline(next),
        hold: (acum: string) => acum.length >= 2
    },

    unknown: classFactory(v => !isLetter(v) && !isSpace(v) && !isNewline(v) && !isSymbol(v))
} as const satisfies Record<string, TokenFactory | (new () => TokenFactory)>;

export type LyricsTokenType = keyof typeof lyricsTokenFactories;

export const lyricsTokenizer = new Tokenizer(lyricsTokenFactories);
