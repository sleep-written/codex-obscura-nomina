import { SONG_METADATA_SPEC, STANZA_METADATA_SPEC, metadataSlots } from './interfaces/index.js';
import type {
    AlterableMarker,
    CommentNode,
    MetadataEntry,
    MetadataValueKind,
    Position,
    Range,
    SongMetadata,
    SongNode,
    StanzaMetadata,
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
    | { kind: 'metadata'; entry: MetadataEntry; part: 'key' | 'value'; owner: 'song' | 'stanza' }
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
 * Finds the metadata entry of a header containing `pos`, reporting which half
 * of `key: value` it landed on. The `:` and the spaces around it belong to
 * neither, so they yield `null` and the search moves on.
 */
function locateMetadata(
    metadata: SongMetadata | StanzaMetadata,
    spec: Record<string, MetadataValueKind>,
    pos: Position
): { entry: MetadataEntry; part: 'key' | 'value' } | null {
    const slots = metadataSlots(metadata);
    for (const key of Object.keys(spec)) {
        const entry = slots[key] ?? null;
        if (entry === null) {
            continue;
        }
        if (contains(entry.keyRange, pos)) {
            return { entry, part: 'key' };
        }
        if (contains(entry.valueRange, pos)) {
            return { entry, part: 'value' };
        }
    }
    return null;
}

/**
 * Finds the most specific AST node (marker, syllable, comment, metadata entry,
 * or title) containing `pos`.
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
    const songMeta = locateMetadata(song.metadata, SONG_METADATA_SPEC, pos);
    if (songMeta !== null) {
        return { kind: 'metadata', ...songMeta, owner: 'song' };
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
        const stanzaMeta = locateMetadata(stanza.metadata, STANZA_METADATA_SPEC, pos);
        if (stanzaMeta !== null) {
            return { kind: 'metadata', ...stanzaMeta, owner: 'stanza' };
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
