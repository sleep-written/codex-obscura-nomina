import { lyricsTokenizer } from '../tokenizer/lyrics-tokenizer.js';
import { parseSong } from './parser.js';
import type { SongNode } from './interfaces/index.js';

export { locate } from './locate.js';
export type { LocateResult } from './locate.js';

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
