import type { AlterableMarker } from '../../ast/interfaces/index.js';

/**
 * One run of graphemes inside a {@link Note}. A note has more than one part
 * only when an alterable marker is currently merging what would otherwise be
 * two notes (`_` diéresis-off, `%` sinéresis-on, `&` sinalefa-on).
 */
export interface NotePart {
    text: string;

    /**
     * The marker that fuses this part with the previous one. `null` on the
     * first part of every note (nothing precedes it to fuse with).
     */
    tie: AlterableMarker | null;
}

/**
 * A singable note: the graphemes emitted in a single beat of the voice. It is
 * *not* the same thing as a {@link SyllableNode} — a sinalefa fuses syllables
 * from two different words into one note, and a diéresis splits one syllable
 * into two.
 */
export interface Note {
    parts: NotePart[];

    /** Concatenation of every part's `text`. */
    text: string;
}

/** The frontier between two consecutive notes of a verse. */
export interface NoteBoundary {
    /**
     * The marker that keeps both notes apart today and could fuse them, or
     * `null` when nothing there is alterable — a plain `-` syllable separator,
     * or a word boundary written as a plain space.
     */
    marker: AlterableMarker | null;

    /** Whether the two notes belong to different words. */
    word: boolean;
}
