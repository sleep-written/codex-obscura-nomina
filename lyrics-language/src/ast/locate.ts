import type {
    AlterableMarker,
    CommentNode,
    Position,
    Range,
    SongNode,
    SyllableNode,
    WordNode
} from './interfaces/index.js';

/**
 * What lives at a given `Position` within a parsed `SongNode`. Consumers
 * (e.g. a VSCode hover/completion provider) convert their own 0-indexed
 * position to this package's 1-indexed `Position` before calling {@link locate}.
 */
export type LocateResult =
    | { kind: 'title'; text: string; range: Range; owner: 'song' | 'stanza' }
    | { kind: 'comment'; comment: CommentNode; owner: 'song' | 'stanza' | 'verse' }
    | { kind: 'marker'; marker: AlterableMarker }
    | { kind: 'syllable'; syllable: SyllableNode; word: WordNode }
    | { kind: 'none' };

/** `start` inclusive, `end` exclusive — same convention as every `Range` in this package. */
function contains(range: Range, pos: Position): boolean {
    if (pos.line < range.start.line || pos.line > range.end.line) {
        return false;
    }
    if (pos.line === range.start.line && pos.column < range.start.column) {
        return false;
    }
    if (pos.line === range.end.line && pos.column >= range.end.column) {
        return false;
    }
    return true;
}

/**
 * Finds the most specific AST node (marker, syllable, comment, or title)
 * containing `pos`.
 *
 * Comment/title checks are NOT gated behind their parent's structural
 * `range`: `StanzaNode.range`/`VerseNode.range` are derived purely from
 * their verses'/words' own spans (see parser.ts), so a comment sitting past
 * the last word on its line falls outside its owning verse's `range` even
 * though it's clearly "in" that verse. Only the word/syllable descent below
 * is safe to prune by `verse.range`, since that range is built from those
 * same word ranges.
 */
export function locate(song: SongNode, pos: Position): LocateResult {
    if (song.title !== null && contains(song.title.range, pos)) {
        return { kind: 'title', text: song.title.text, range: song.title.range, owner: 'song' };
    }
    for (const comment of song.comments) {
        if (contains(comment.range, pos)) {
            return { kind: 'comment', comment, owner: 'song' };
        }
    }

    for (const stanza of song.stanzas) {
        if (stanza.title !== null && contains(stanza.title.range, pos)) {
            return { kind: 'title', text: stanza.title.text, range: stanza.title.range, owner: 'stanza' };
        }
        for (const comment of stanza.comments) {
            if (contains(comment.range, pos)) {
                return { kind: 'comment', comment, owner: 'stanza' };
            }
        }

        for (const verse of stanza.verses) {
            for (const comment of verse.comments) {
                if (contains(comment.range, pos)) {
                    return { kind: 'comment', comment, owner: 'verse' };
                }
            }
            if (!contains(verse.range, pos)) {
                continue;
            }

            for (const word of verse.words) {
                if (word.trailingJoin !== null && contains(word.trailingJoin.range, pos)) {
                    return { kind: 'marker', marker: word.trailingJoin };
                }
                if (!contains(word.range, pos)) {
                    continue;
                }
                for (const syllable of word.syllables) {
                    if (!contains(syllable.range, pos)) {
                        continue;
                    }
                    if (syllable.internalMarker !== null && contains(syllable.internalMarker.range, pos)) {
                        return { kind: 'marker', marker: syllable.internalMarker };
                    }
                    if (typeof syllable.boundary === 'object' && syllable.boundary !== null && contains(syllable.boundary.range, pos)) {
                        return { kind: 'marker', marker: syllable.boundary };
                    }
                    return { kind: 'syllable', syllable, word };
                }
            }
        }
    }
    return { kind: 'none' };
}
