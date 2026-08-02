import type { Note, NoteBoundary } from './note.js';

/** How many notes a verse sings today, and how far that count can be stretched. */
export interface VerseMetrics {
    /** The notes as they are sung with the markers in their current state. */
    notes: Note[];

    /** `boundaries[i]` separates `notes[i]` from `notes[i + 1]`. */
    boundaries: NoteBoundary[];

    /** Notes sung today — same as `notes.length`. */
    count: number;

    /** Notes left if every alterable marker of the verse were set to fuse. */
    min: number;

    /** Notes left if every alterable marker of the verse were set to split. */
    max: number;
}

/** Per-verse metrics of a stanza, plus the extremes across all of its verses. */
export interface StanzaMetrics {
    verses: VerseMetrics[];

    /** Lowest `min` among the verses; `0` when the stanza has none. */
    min: number;

    /** Highest `max` among the verses; `0` when the stanza has none. */
    max: number;
}

/** Per-stanza metrics of a song, plus the extremes across all of its stanzas. */
export interface SongMetrics {
    stanzas: StanzaMetrics[];

    /** Lowest `min` among the stanzas; `0` when the song has none. */
    min: number;

    /** Highest `max` among the stanzas; `0` when the song has none. */
    max: number;
}
