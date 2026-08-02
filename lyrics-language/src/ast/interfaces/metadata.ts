import type { Range } from './position.js';

/** How a metadata key's raw text is interpreted: verbatim, or as a non-negative integer. */
export type MetadataValueKind = 'text' | 'number';

/**
 * The metadata keys valid in the SONG header — the block of `key: value` lines
 * at the very top of the file, after the `#` title and before the first stanza.
 */
export const SONG_METADATA_SPEC = {
    artist: 'text',
    album: 'text',
    albumArtist: 'text',
    albumYear: 'number',
    trackNumber: 'number'
} as const satisfies Record<string, MetadataValueKind>;

/**
 * The metadata keys valid in a STANZA header — the block of `key: value` lines
 * at the top of a stanza, after its `##` title (if any) and before its first verse.
 */
export const STANZA_METADATA_SPEC = {
    desiredLength: 'number'
} as const satisfies Record<string, MetadataValueKind>;

export type SongMetadataKey = keyof typeof SONG_METADATA_SPEC;
export type StanzaMetadataKey = keyof typeof STANZA_METADATA_SPEC;

/**
 * Every recognized key, across both scopes. The two key sets are deliberately
 * disjoint: the key alone tells the parser which header a line belongs to, so
 * an untitled first stanza's metadata is never mistaken for the song's.
 */
export type MetadataKey = SongMetadataKey | StanzaMetadataKey;

/** One `key: value` line, with the spans needed to hover either half of it. */
export interface MetadataEntry<V extends string | number = string | number> {
    /** The key, exactly as written (it must match one of the recognized keys). */
    key: MetadataKey;
    /** The parsed value: the trimmed text itself, or a number for a numeric key. */
    value: V;
    /** Span of the key. */
    keyRange: Range;
    /** Span of the trimmed value text — excludes `key:` and any surrounding spaces. */
    valueRange: Range;
    /** Span of the whole entry, from the key's first grapheme to the value's last. */
    range: Range;
}

export type TextMetadataEntry = MetadataEntry<string>;
export type NumberMetadataEntry = MetadataEntry<number>;

/** The song's optional header metadata; every field is `null` when its line is absent. */
export interface SongMetadata {
    artist: TextMetadataEntry | null;
    album: TextMetadataEntry | null;
    albumArtist: TextMetadataEntry | null;
    albumYear: NumberMetadataEntry | null;
    trackNumber: NumberMetadataEntry | null;
}

/** A stanza's optional header metadata; every field is `null` when its line is absent. */
export interface StanzaMetadata {
    /**
     * The note count each verse of this stanza is aiming for. Purely the
     * author's stated intent — nothing in this package validates a verse
     * against it; compare it against `verseMetrics(verse).count` yourself.
     */
    desiredLength: NumberMetadataEntry | null;
}

/**
 * Views a header's metadata record as a plain key → entry map.
 *
 * The records above are keyed by a narrow literal union and typed per value
 * kind, and neither survives a key widened to {@link MetadataKey} — so every
 * pass that walks a header generically (parsing, printing, `locate`) funnels
 * through this single cast instead of repeating one at each call site. The
 * guarantee that a key and its entry line up comes from the spec lookup the
 * parser does before storing anything.
 */
export function metadataSlots(metadata: SongMetadata | StanzaMetadata): Record<string, MetadataEntry | null> {
    return metadata as unknown as Record<string, MetadataEntry | null>;
}

export function emptySongMetadata(): SongMetadata {
    return { artist: null, album: null, albumArtist: null, albumYear: null, trackNumber: null };
}

export function emptyStanzaMetadata(): StanzaMetadata {
    return { desiredLength: null };
}
