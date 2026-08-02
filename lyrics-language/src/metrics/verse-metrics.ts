import type { AlterableMarker, VerseNode } from '../ast/interfaces/index.js';
import type { Note, NoteBoundary, NotePart, VerseMetrics } from './interfaces/index.js';
import { markerMerges } from './marker-merges.js';

/** A possible note frontier: `marker` is `null` when nothing there is alterable. */
interface Link {
    marker: AlterableMarker | null;
    word: boolean;
}

/**
 * The verse flattened into the smallest pieces a marker can ever separate,
 * plus the links between them. `links[i]` sits between `atoms[i]` and
 * `atoms[i + 1]`, so `links.length` is always `atoms.length - 1`.
 */
interface AtomChain {
    atoms: string[];
    links: Link[];
}

/**
 * Splits the verse at *every* possible note frontier, whether or not it is
 * fused today: syllable separators, alterable boundaries (`+`/`/`), internal
 * markers (`_`/`%`) and word boundaries (`&`/`|`/space).
 *
 * An internal marker lives *inside* its syllable's `text` (which never carries
 * the symbol itself), so the cut point is derived from `range`: the marker's
 * column offset from the syllable's start equals the number of graphemes
 * before it. This is the same arithmetic `spliceInternalMarker` uses in
 * `../ast/printer.js`, in the opposite direction.
 */
function verseAtoms(verse: VerseNode): AtomChain {
    const atoms: string[] = [];
    const links: Link[] = [];

    const addAtom = (text: string): void => {
        if (text.length > 0) {
            atoms.push(text);
        }
    };

    // Keeps `links.length === atoms.length - 1` even on degenerate input (a
    // marker before any text, or two markers in a row) by padding with an
    // empty atom instead of dropping the marker.
    const addLink = (marker: AlterableMarker | null, word = false): void => {
        if (links.length === atoms.length) {
            atoms.push('');
        }
        links.push({ marker, word });
    };

    for (const [index, word] of verse.words.entries()) {
        for (const syllable of word.syllables) {
            const internal = syllable.internalMarker;
            if (internal !== null) {
                const offset = internal.range.start.column - syllable.range.start.column;
                addAtom(syllable.text.slice(0, offset));
                addLink(internal);
                addAtom(syllable.text.slice(offset));
            } else {
                addAtom(syllable.text);
            }

            if (syllable.boundary === 'separator') {
                addLink(null);
            } else if (syllable.boundary !== null) {
                addLink(syllable.boundary);
            }
        }

        // Every word boundary is a note frontier, alterable (`&`/`|`) or not
        // (a plain space, whose `trailingJoin` is null just like the verse's
        // last word — hence the index check rather than a null check, or the
        // atoms and links would fall out of step).
        if (index < verse.words.length - 1) {
            addLink(word.trailingJoin, true);
        }
    }

    // A trailing link (a verse ending in a separator) has nothing after it.
    while (links.length >= atoms.length && links.length > 0) {
        links.pop();
    }

    return { atoms, links };
}

/**
 * Groups a verse into the notes it sings today and reports how far that count
 * can be pushed by toggling its markers — `min` fusing every alterable marker,
 * `max` splitting all of them. Frontiers that are not alterable (a plain `-`,
 * a plain space) are counted in every scenario.
 */
export function verseMetrics(verse: VerseNode): VerseMetrics {
    const { atoms, links } = verseAtoms(verse);

    const notes: Note[] = [];
    const boundaries: NoteBoundary[] = [];
    let parts: NotePart[] = [];
    let alterable = 0;

    const closeNote = (): void => {
        notes.push({ parts, text: parts.map(part => part.text).join('') });
        parts = [];
    };

    for (const [index, text] of atoms.entries()) {
        const link = index === 0 ? null : links[index - 1];
        if (link !== null && link.marker !== null && markerMerges(link.marker)) {
            parts.push({ text, tie: link.marker });
        } else {
            if (link !== null) {
                closeNote();
                boundaries.push({ marker: link.marker, word: link.word });
            }
            parts.push({ text, tie: null });
        }
    }

    if (atoms.length > 0) {
        closeNote();
    }

    for (const link of links) {
        if (link.marker !== null) {
            alterable++;
        }
    }

    return {
        notes,
        boundaries,
        count: notes.length,
        min: atoms.length - alterable,
        max: atoms.length
    };
}
