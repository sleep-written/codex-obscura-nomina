import type { Range } from './position.js';

/**
 * A vowel-pair or word-boundary marker whose state was explicitly set in the
 * source `.lyrics` file (diéresis/sinéresis inside a word, sinalefa between
 * words). `active` reflects which of the marker's two symbols was used.
 */
export interface AlterableMarker {
    kind: 'diaeresis' | 'synaeresis' | 'sinalefa';
    active: boolean;
    /** Span of the single DSL symbol (`+`/`_`/`%`/`/`/`&`) that set this marker. */
    range: Range;
}

/** A `//` comment, with its `//` prefix and leading space already stripped. */
export interface CommentNode {
    text: string;
    range: Range;
}

/** Text reconstructed from a run of tokens (song/stanza title), with its span. */
export interface TitledText {
    text: string;
    range: Range;
}

export interface SyllableNode {
    /** Literal graphemes of this syllable, with all DSL symbols stripped. */
    text: string;

    /**
     * A vowel-pair marker that does NOT split this syllable from the next
     * one (`_` diéresis-off or `%` sinéresis-on): it lives inside `text`.
     */
    internalMarker: AlterableMarker | null;

    /**
     * The boundary to the NEXT syllable within the same word:
     * - `'separator'`: plain `-`, not alterable.
     * - `AlterableMarker`: the symbol itself IS the boundary (`+` diéresis-on
     *   or `/` sinéresis-off).
     * - `null`: this is the word's last syllable — the boundary to the next
     *   word (if any) is tracked by {@link WordNode.trailingJoin} instead.
     */
    boundary: 'separator' | AlterableMarker | null;

    /** Span of this syllable's text + internal marker + boundary symbol. */
    range: Range;
}

export interface WordNode {
    syllables: SyllableNode[];

    /**
     * The boundary to the NEXT word in the verse (`kind: 'sinalefa'`), written
     * `&` when active and `|` when not. `null` on the verse's last word, and
     * also on any boundary written as a plain space — a space means no vowel
     * meets a vowel across it, so there is nothing to alter there.
     */
    trailingJoin: AlterableMarker | null;

    /** Span of this word's own text only (excludes the trailing separator/`&`). */
    range: Range;
}

export interface VerseNode {
    /** Comments attached to this verse (leading and/or trailing). */
    comments: CommentNode[];
    words: WordNode[];
    range: Range;
}

export interface StanzaNode {
    /** From `##Título`; `null` if the stanza has no title. */
    title: TitledText | null;
    /** Comments attached to this stanza (leading and/or trailing). */
    comments: CommentNode[];
    verses: VerseNode[];
    range: Range;
}

export interface SongNode {
    /** From `#Título`; `null` if the song has no title. */
    title: TitledText | null;
    /** Comments attached to the song as a whole (leading and/or trailing). */
    comments: CommentNode[];
    stanzas: StanzaNode[];
    range: Range;
}
