import type { SongNode, StanzaNode } from '../ast/interfaces/index.js';
import type { SongMetrics, StanzaMetrics } from './interfaces/index.js';
import { verseMetrics } from './verse-metrics.js';

/** Lowest `min` / highest `max` of a list, or `0`/`0` when it is empty. */
function extremes(items: readonly { min: number; max: number }[]): { min: number; max: number } {
    return {
        min: items.length === 0 ? 0 : Math.min(...items.map(item => item.min)),
        max: items.length === 0 ? 0 : Math.max(...items.map(item => item.max))
    };
}

/**
 * {@link verseMetrics} for every verse of the stanza, plus the extremes across
 * them — the natural scale to plot all of its verses against each other.
 */
export function stanzaMetrics(stanza: StanzaNode): StanzaMetrics {
    const verses = stanza.verses.map(verseMetrics);
    return { verses, ...extremes(verses) };
}

/** {@link stanzaMetrics} for every stanza of the song, plus the extremes across them. */
export function songMetrics(song: SongNode): SongMetrics {
    const stanzas = song.stanzas.map(stanzaMetrics);
    return { stanzas, ...extremes(stanzas) };
}
