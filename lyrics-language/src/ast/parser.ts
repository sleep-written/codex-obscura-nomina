import type { Token } from '../tokenizer/interfaces/index.js';
import type { LyricsTokenType } from '../tokenizer/lyrics-tokenizer.js';
import { LyricsParseError } from './lyrics-parse.error.js';
import type {
    AlterableMarker,
    CommentNode,
    Range,
    SongNode,
    StanzaNode,
    SyllableNode,
    TitledText,
    VerseNode,
    WordNode
} from './interfaces/index.js';

type LyricsToken = Token<LyricsTokenType>;

interface Line {
    /** Content tokens of the line, with any trailing comment token removed. */
    tokens: LyricsToken[];
    /** Trailing comment on this line's own content line, if any. */
    comment: CommentNode | null;
    endedBy: 'verse-end' | 'stanza-end' | 'eof';
}

/** Span of a single, single-line token: from its start to one column past its last grapheme. */
function tokenRange(tok: LyricsToken): Range {
    return {
        start: { line: tok.line, column: tok.column },
        end: { line: tok.line, column: tok.column + tok.length }
    };
}

/** Span from the start of `from` to the end of `to`. */
function spanRange(from: LyricsToken, to: LyricsToken): Range {
    return { start: tokenRange(from).start, end: tokenRange(to).end };
}

/** Strips the `//` prefix and leading space from a comment token, keeping its range aligned. */
function stripComment(tok: LyricsToken): CommentNode {
    const raw = tok.value.slice(2);
    const text = raw.trimStart();
    const trimmed = raw.length - text.length;
    return {
        text,
        range: {
            start: { line: tok.line, column: tok.column + 2 + trimmed },
            end: tokenRange(tok).end
        }
    };
}

/** Splits a flat token stream into lines, pulling out each line's trailing comment (if any). */
function splitLines(tokens: LyricsToken[]): Line[] {
    const lines: Line[] = [];
    let buf: LyricsToken[] = [];

    const flush = (endedBy: Line['endedBy']): void => {
        let comment: CommentNode | null = null;
        if (buf.length > 0 && buf[buf.length - 1].type === 'comment') {
            comment = stripComment(buf.pop()!);
            // The whitespace that only served to separate content from the
            // comment isn't a real trailing word-separator — drop it too.
            if (buf.length > 0 && buf[buf.length - 1].type === 'word-separator') {
                buf.pop();
            }
        }
        if (buf.length > 0 || comment !== null) {
            lines.push({ tokens: buf, comment, endedBy });
        }
        buf = [];
    };

    for (const tok of tokens) {
        if (tok.type === 'verse-end' || tok.type === 'stanza-end') {
            flush(tok.type);
        } else {
            buf.push(tok);
        }
    }
    flush('eof');

    return lines;
}

/** Reconstructs the literal text + range spanned by a run of tokens (used for titles). */
function tokensToText(tokens: LyricsToken[]): TitledText {
    const raw = tokens.map(tok => tok.value).join('');
    const text = raw.trim();
    const leadingTrimmed = raw.length - raw.trimStart().length;
    const trailingTrimmed = raw.length - raw.trimEnd().length;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    return {
        text,
        range: {
            start: { line: first.line, column: first.column + leadingTrimmed },
            end: { line: last.line, column: last.column + last.length - trailingTrimmed }
        }
    };
}

/** Builds a `SyllableNode[]` from the tokens of a single word. */
function parseWord(tokens: LyricsToken[]): WordNode {
    if (tokens.length === 0) {
        // Both call sites in parseVerse already guard against this — kept as
        // a defense-in-depth invariant, not reachable via any valid .lyrics
        // input. Not a LyricsParseError: there is no real source position to
        // report for an empty token list.
        throw new Error('parseWord: internal invariant violated — called with an empty token list');
    }

    const syllables: SyllableNode[] = [];
    let text = '';
    let internalMarker: AlterableMarker | null = null;
    let sawText = false;
    let syllableStartTok: LyricsToken | null = null;

    const closeSyllable = (boundary: SyllableNode['boundary'], at: LyricsToken): void => {
        if (!sawText) {
            throw new LyricsParseError('A syllable cannot be empty', at.line, at.column);
        }
        syllables.push({ text, internalMarker, boundary, range: spanRange(syllableStartTok!, at) });
        text = '';
        internalMarker = null;
        sawText = false;
        syllableStartTok = null;
    };

    for (const tok of tokens) {
        switch (tok.type) {
            case 'text':
                if (syllableStartTok === null) {
                    syllableStartTok = tok;
                }
                text += tok.value;
                sawText = true;
                break;

            case 'syllable-separator':
                closeSyllable('separator', tok);
                break;
            case 'diaeresis-on':
                closeSyllable({ kind: 'diaeresis', active: true, range: tokenRange(tok) }, tok);
                break;
            case 'synaeresis-off':
                closeSyllable({ kind: 'synaeresis', active: false, range: tokenRange(tok) }, tok);
                break;

            case 'diaeresis-off':
                if (!sawText) {
                    throw new LyricsParseError('Diéresis marker must follow a vowel', tok.line, tok.column);
                }
                internalMarker = { kind: 'diaeresis', active: false, range: tokenRange(tok) };
                break;
            case 'synaeresis-on':
                if (!sawText) {
                    throw new LyricsParseError('Sinéresis marker must follow a vowel', tok.line, tok.column);
                }
                internalMarker = { kind: 'synaeresis', active: true, range: tokenRange(tok) };
                break;

            default:
                throw new LyricsParseError(`Unexpected "${tok.value}" inside a word`, tok.line, tok.column);
        }
    }
    closeSyllable(null, tokens[tokens.length - 1]);

    return { syllables, trailingJoin: null, range: spanRange(tokens[0], tokens[tokens.length - 1]) };
}

/** Splits a verse line's tokens into `WordNode[]`, joined by sinalefa/space. */
function parseVerse(tokens: LyricsToken[]): { words: WordNode[]; range: Range } {
    const words: WordNode[] = [];
    let buf: LyricsToken[] = [];

    for (const tok of tokens) {
        if (tok.type === 'word-separator' || tok.type === 'sinalefa') {
            if (buf.length === 0) {
                throw new LyricsParseError('A word cannot be empty', tok.line, tok.column);
            }
            const word = parseWord(buf);
            word.trailingJoin = { kind: 'sinalefa', active: tok.type === 'sinalefa', range: tokenRange(tok) };
            words.push(word);
            buf = [];
        } else {
            buf.push(tok);
        }
    }
    if (buf.length === 0) {
        const last = tokens[tokens.length - 1];
        throw new LyricsParseError('A word cannot be empty', last.line, last.column);
    }
    words.push(parseWord(buf));

    return { words, range: { start: words[0].range.start, end: words[words.length - 1].range.end } };
}

/**
 * Parses a full `.lyrics` token stream into a {@link SongNode}.
 *
 * Single forward pass over the file's lines: comment-only lines are buffered
 * as "pending" and attached as leading comments to whatever structural node
 * (song title, stanza title, or verse) comes next; a `stanza-end` closes the
 * currently open stanza. Anything still pending at the very end of the file
 * (or of a stanza, with nothing left to lead) attaches as a trailing comment
 * to the innermost node still open (last verse > stanza > song).
 */
export function parseSong(tokens: LyricsToken[]): SongNode {
    const lines = splitLines(tokens);

    const song: SongNode = {
        title: null,
        comments: [],
        stanzas: [],
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
    };
    let pending: CommentNode[] = [];
    let currentStanza: StanzaNode | null = null;

    const closeCurrentStanza = (): void => {
        if (currentStanza !== null) {
            song.range = song.title === null && song.stanzas.length === 0
                ? { start: currentStanza.range.start, end: currentStanza.range.end }
                : { start: song.range.start, end: currentStanza.range.end };
            song.stanzas.push(currentStanza);
            currentStanza = null;
        }
    };

    for (const line of lines) {
        const first = line.tokens[0];

        if (line.tokens.length === 0) {
            if (line.comment !== null) {
                pending.push(line.comment);
            }
            if (line.endedBy === 'stanza-end') {
                closeCurrentStanza();
            }
            continue;
        }

        if (first.type === 'song-title-marker') {
            if (song.title !== null || song.stanzas.length > 0 || currentStanza !== null) {
                throw new LyricsParseError('A song can only have one title, at the very top', first.line, first.column);
            }
            const title = tokensToText(line.tokens.slice(1));
            if (title.text.length === 0) {
                throw new LyricsParseError('Song title cannot be empty', first.line, first.column);
            }
            song.title = title;
            song.range = { start: tokenRange(first).start, end: title.range.end };
            song.comments.push(...pending);
            pending = [];
            if (line.comment !== null) {
                song.comments.push(line.comment);
            }
            continue;
        }

        if (first.type === 'stanza-title-marker') {
            if (currentStanza !== null) {
                throw new LyricsParseError('A stanza can only have one title, at its very top', first.line, first.column);
            }
            const title = tokensToText(line.tokens.slice(1));
            if (title.text.length === 0) {
                throw new LyricsParseError('Stanza title cannot be empty', first.line, first.column);
            }
            currentStanza = {
                title,
                comments: [...pending],
                verses: [],
                range: { start: tokenRange(first).start, end: title.range.end }
            };
            pending = [];
            if (line.comment !== null) {
                currentStanza.comments.push(line.comment);
            }
            if (line.endedBy === 'stanza-end') {
                closeCurrentStanza();
            }
            continue;
        }

        const verse: VerseNode = { comments: pending, ...parseVerse(line.tokens) };
        pending = [];
        if (line.comment !== null) {
            verse.comments.push(line.comment);
        }

        if (currentStanza === null) {
            currentStanza = { title: null, comments: [], verses: [], range: { ...verse.range } };
        } else {
            currentStanza.range = { start: currentStanza.range.start, end: verse.range.end };
        }
        currentStanza.verses.push(verse);

        if (line.endedBy === 'stanza-end') {
            closeCurrentStanza();
        }
    }
    closeCurrentStanza();

    if (pending.length > 0) {
        const lastStanza = song.stanzas[song.stanzas.length - 1];
        const lastVerse = lastStanza?.verses[lastStanza.verses.length - 1];
        if (lastVerse) {
            lastVerse.comments.push(...pending);
        } else if (lastStanza) {
            lastStanza.comments.push(...pending);
        } else {
            song.comments.push(...pending);
        }
    }

    return song;
}
