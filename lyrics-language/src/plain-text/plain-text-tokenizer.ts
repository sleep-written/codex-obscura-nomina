import { Character } from '../tokenizer/character.js';
import { canSinalefa } from '../phonetics/sinalefa.js';
import { syllabifyWord } from '../phonetics/syllabify-word.js';
import type { LyricsToken } from '../tokenizer/lyrics-tokenizer.js';

const isLetter = (v: string): boolean => /\p{L}/u.test(v);

/** Canonical symbol used only for `.value` traceability — these tokens carry `length: 0` (see below). */
const SYMBOL = {
    'syllable-separator': '-',
    'diaeresis-off': '_',
    'synaeresis-off': '/'
} as const;

/**
 * Translates one plain (letters-only) word into the token sequence a hand-annotated
 * `.lyrics` word would produce. `syllable-separator`/`diaeresis-off`/`synaeresis-off`
 * tokens are synthetic: they don't correspond to any character in the plain-text
 * source, so they're emitted with `length: 0` at the column of the boundary they
 * mark. This is safe because `parseWord` never reads `.value` for these three token
 * types, only `tokenRange` (which is `column`/`length`-based) — a zero-length range
 * at the exact boundary is the correct span for a symbol that was never typed.
 */
function syllabifyWordToTokens(word: string, line: number, startColumn: number): LyricsToken[] {
    const events = syllabifyWord(word);
    const tokens: LyricsToken[] = [];
    let cursor = 0;
    let column = startColumn;

    for (const event of events) {
        if (event.offset > cursor) {
            const chunk = word.slice(cursor, event.offset);
            tokens.push({ type: 'text', value: chunk, line, column, length: chunk.length });
            column += chunk.length;
            cursor = event.offset;
        }
        tokens.push({ type: event.kind, value: SYMBOL[event.kind], line, column, length: 0 });
    }
    if (cursor < word.length) {
        const chunk = word.slice(cursor);
        tokens.push({ type: 'text', value: chunk, line, column, length: chunk.length });
    }

    return tokens;
}

/**
 * Translates unannotated Spanish lyrics text into the same shape of
 * `LyricsToken[]` that `lyricsTokenizer` produces for an already-annotated
 * `.lyrics` source, so that `parseSong` (see `../ast/parser.js`) can consume
 * it without any changes. Syllable boundaries and the natural diphthong/hiato
 * state of each vowel pair are computed by {@link syllabifyWord} instead of
 * being read off `-`/`_`/`/` symbols — plain text never expresses an altered
 * state, so only the "off" symbols (`_`/`/`) are ever synthesized, never
 * `+`/`%`.
 *
 * `#`/`##` titles and `//` comments are recognized literally, exactly as in
 * the annotated DSL. Any other grapheme this scanner doesn't recognize —
 * punctuation, digits, or a DSL symbol typed loose (`- & | + _ % /`) — is
 * silently dropped, since plain text is by definition unannotated.
 *
 * A run of spaces becomes a `sinalefa-off` boundary when a vowel sound meets a
 * vowel sound across it (see {@link canSinalefa}) and a plain `word-separator`
 * otherwise — the same distinction the annotated DSL writes as `|` vs a space.
 * The sinalefa is never *applied*, only declared possible: plain text can't
 * express an author's decision, so `&` is never synthesized (nor is `+`/`%`).
 */
export function tokenizePlainLyrics(source: string): LyricsToken[] {
    const chars = Character.split(source.normalize('NFC'));
    const tokens: LyricsToken[] = [];

    let i = 0;
    let inTitleLine = false;

    /**
     * The word immediately behind the cursor, or `''` if anything else came in
     * between. Reset by every dropped grapheme too: with punctuation between
     * two words ("salí, a") the boundary is no longer a bare word boundary, so
     * it stays a plain separator rather than an alterable sinalefa.
     */
    let previousWord = '';

    /** The letters starting at `from`, without consuming them. */
    const peekWord = (from: number): string => {
        let j = from;
        while (j < chars.length && isLetter(chars[j].toString())) {
            j++;
        }
        return chars.slice(from, j).map(ch => ch.toString()).join('');
    };

    while (i < chars.length) {
        const start = chars[i];
        const v = start.toString();

        if (v === '\n') {
            let j = i;
            while (j < chars.length && chars[j].toString() === '\n') {
                j++;
            }
            const length = j - i;
            tokens.push({
                type: length === 1 ? 'verse-end' : 'stanza-end',
                value: '\n'.repeat(length),
                line: start.row, column: start.col, length
            });
            inTitleLine = false;
            previousWord = '';
            i = j;
            continue;
        }

        if (v === ' ') {
            let j = i;
            while (j < chars.length && chars[j].toString() === ' ') {
                j++;
            }
            const length = j - i;
            const alterable = !inTitleLine && canSinalefa(previousWord, peekWord(j));
            tokens.push({
                type: alterable ? 'sinalefa-off' : 'word-separator',
                value: alterable ? '|' : ' '.repeat(length),
                line: start.row, column: start.col, length
            });
            previousWord = '';
            i = j;
            continue;
        }

        if (v === '#') {
            let j = i;
            while (j < chars.length && chars[j].toString() === '#') {
                j++;
            }
            const length = j - i;
            tokens.push({
                type: length === 1 ? 'song-title-marker' : 'stanza-title-marker',
                value: '#'.repeat(length),
                line: start.row, column: start.col, length
            });
            inTitleLine = true;
            previousWord = '';
            i = j;
            continue;
        }

        if (v === '/' && chars[i + 1]?.toString() === '/') {
            let j = i;
            while (j < chars.length && chars[j].toString() !== '\n') {
                j++;
            }
            const value = chars.slice(i, j).map(ch => ch.toString()).join('');
            tokens.push({ type: 'comment', value, line: start.row, column: start.col, length: j - i });
            previousWord = '';
            i = j;
            continue;
        }

        if (isLetter(v)) {
            let j = i;
            while (j < chars.length && isLetter(chars[j].toString())) {
                j++;
            }
            const word = chars.slice(i, j).map(ch => ch.toString()).join('');
            if (inTitleLine) {
                // Titles are reconstructed by concatenating raw token .value (see
                // `tokensToText` in parser.ts) — segmenting into syllables here
                // would inject synthetic hyphens into the title text itself.
                tokens.push({ type: 'text', value: word, line: start.row, column: start.col, length: word.length });
            } else {
                tokens.push(...syllabifyWordToTokens(word, start.row, start.col));
            }
            previousWord = word;
            i = j;
            continue;
        }

        // Punctuation, digits, or a loose DSL symbol: not part of the plain-text alphabet.
        previousWord = '';
        i++;
    }

    return tokens;
}
