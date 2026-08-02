import { lyricsTokenizer } from '../tokenizer/lyrics-tokenizer.js';
import { tokenizePlainLyrics } from '../plain-text/plain-text-tokenizer.js';
import { parseSong } from './parser.js';
import type { SongNode } from './interfaces/index.js';

export { locate } from './locate.js';
export type { LocateResult } from './locate.js';
export { printLyrics } from './printer.js';

export type {
    AlterableMarker,
    CommentNode,
    TitledText,
    Position,
    Range,
    SongNode,
    StanzaNode,
    SyllableNode,
    VerseNode,
    WordNode
} from './interfaces/index.js';
export { LyricsParseError } from './lyrics-parse.error.js';

/** Tokenizes and parses a `.lyrics` source string into a {@link SongNode}. */
export function parseLyrics(source: string): SongNode {
    return parseSong(lyricsTokenizer.tokenize(source));
}

/**
 * Parses unannotated Spanish lyrics text (no syllable separators, no
 * diéresis/sinéresis/sinalefa marks) into a {@link SongNode}, computing
 * syllable boundaries and each vowel pair's natural diphthong/hiato state
 * automatically. `#`/`##` titles and `//` comments are still recognized
 * literally; everything else unrecognized (punctuation, digits) is dropped.
 */
export function parsePlainLyrics(source: string): SongNode {
    return parseSong(tokenizePlainLyrics(source));
}
