import type { Token } from '../tokenizer/interfaces/index.js';
import type { LyricsTokenType } from '../tokenizer/lyrics-tokenizer.js';
import { LyricsParseError } from './lyrics-parse.error.js';
import type {
    AlterableMarker,
    SongNode,
    StanzaNode,
    SyllableNode,
    VerseNode,
    WordNode
} from './interfaces/index.js';

type LyricsToken = Token<LyricsTokenType>;

interface Line {
    /** Content tokens of the line, with any trailing comment token removed. */
    tokens: LyricsToken[];
    /** Trailing comment text on this line's own content line, if any. */
    comment: string | null;
    endedBy: 'verse-end' | 'stanza-end' | 'eof';
}

const stripComment = (value: string): string => value.slice(2).trimStart();

/** Splits a flat token stream into lines, pulling out each line's trailing comment (if any). */
function splitLines(tokens: LyricsToken[]): Line[] {
    const lines: Line[] = [];
    let buf: LyricsToken[] = [];

    const flush = (endedBy: Line['endedBy']): void => {
        let comment: string | null = null;
        if (buf.length > 0 && buf[buf.length - 1].type === 'comment') {
            comment = stripComment(buf.pop()!.value);
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

/** Reconstructs the literal text spanned by a run of tokens (used for titles). */
function tokensToText(tokens: LyricsToken[]): string {
    return tokens.map(tok => tok.value).join('').trim();
}

/** Builds a `SyllableNode[]` from the tokens of a single word. */
function parseWord(tokens: LyricsToken[]): WordNode {
    if (tokens.length === 0) {
        throw new LyricsParseError('A word cannot be empty', 0, 0);
    }

    const syllables: SyllableNode[] = [];
    let text = '';
    let internalMarker: AlterableMarker | null = null;
    let sawText = false;

    const closeSyllable = (boundary: SyllableNode['boundary'], at: LyricsToken): void => {
        if (!sawText) {
            throw new LyricsParseError('A syllable cannot be empty', at.line, at.column);
        }
        syllables.push({ text, internalMarker, boundary });
        text = '';
        internalMarker = null;
        sawText = false;
    };

    for (const tok of tokens) {
        switch (tok.type) {
            case 'text':
                text += tok.value;
                sawText = true;
                break;

            case 'syllable-separator':
                closeSyllable('separator', tok);
                break;
            case 'diaeresis-on':
                closeSyllable({ kind: 'diaeresis', active: true }, tok);
                break;
            case 'synaeresis-off':
                closeSyllable({ kind: 'synaeresis', active: false }, tok);
                break;

            case 'diaeresis-off':
                if (!sawText) {
                    throw new LyricsParseError('Diéresis marker must follow a vowel', tok.line, tok.column);
                }
                internalMarker = { kind: 'diaeresis', active: false };
                break;
            case 'synaeresis-on':
                if (!sawText) {
                    throw new LyricsParseError('Sinéresis marker must follow a vowel', tok.line, tok.column);
                }
                internalMarker = { kind: 'synaeresis', active: true };
                break;

            default:
                throw new LyricsParseError(`Unexpected "${tok.value}" inside a word`, tok.line, tok.column);
        }
    }
    closeSyllable(null, tokens[tokens.length - 1]);

    return { syllables, trailingJoin: null };
}

/** Splits a verse line's tokens into `WordNode[]`, joined by sinalefa/space. */
function parseVerse(tokens: LyricsToken[]): { words: WordNode[] } {
    const words: WordNode[] = [];
    let buf: LyricsToken[] = [];

    for (const tok of tokens) {
        if (tok.type === 'word-separator' || tok.type === 'sinalefa') {
            if (buf.length === 0) {
                throw new LyricsParseError('A word cannot be empty', tok.line, tok.column);
            }
            const word = parseWord(buf);
            word.trailingJoin = { kind: 'sinalefa', active: tok.type === 'sinalefa' };
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

    return { words };
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

    const song: SongNode = { title: null, comments: [], stanzas: [] };
    let pending: string[] = [];
    let currentStanza: StanzaNode | null = null;

    const closeCurrentStanza = (): void => {
        if (currentStanza !== null) {
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
            if (title.length === 0) {
                throw new LyricsParseError('Song title cannot be empty', first.line, first.column);
            }
            song.title = title;
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
            if (title.length === 0) {
                throw new LyricsParseError('Stanza title cannot be empty', first.line, first.column);
            }
            currentStanza = { title, comments: [...pending], verses: [] };
            pending = [];
            if (line.comment !== null) {
                currentStanza.comments.push(line.comment);
            }
            if (line.endedBy === 'stanza-end') {
                closeCurrentStanza();
            }
            continue;
        }

        if (currentStanza === null) {
            currentStanza = { title: null, comments: [], verses: [] };
        }

        const verse: VerseNode = { comments: pending, ...parseVerse(line.tokens) };
        pending = [];
        if (line.comment !== null) {
            verse.comments.push(line.comment);
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
