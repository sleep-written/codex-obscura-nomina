/**
 * A vowel-pair or word-boundary marker whose state was explicitly set in the
 * source `.lyrics` file (diéresis/sinéresis inside a word, sinalefa between
 * words). `active` reflects which of the marker's two symbols was used.
 */
export interface AlterableMarker {
    kind: 'diaeresis' | 'synaeresis' | 'sinalefa';
    active: boolean;
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
}

export interface WordNode {
    syllables: SyllableNode[];

    /**
     * The boundary to the NEXT word in the verse (`kind: 'sinalefa'`).
     * `null` on the verse's last word.
     */
    trailingJoin: AlterableMarker | null;
}

export interface VerseNode {
    /** Comments attached to this verse (leading and/or trailing). */
    comments: string[];
    words: WordNode[];
}

export interface StanzaNode {
    /** From `##Título`; `null` if the stanza has no title. */
    title: string | null;
    /** Comments attached to this stanza (leading and/or trailing). */
    comments: string[];
    verses: VerseNode[];
}

export interface SongNode {
    /** From `#Título`; `null` if the song has no title. */
    title: string | null;
    /** Comments attached to the song as a whole (leading and/or trailing). */
    comments: string[];
    stanzas: StanzaNode[];
}
