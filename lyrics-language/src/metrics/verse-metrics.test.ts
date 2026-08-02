import { describe, it } from 'node:test';
import { emptyStanzaMetadata, parseLyrics, parsePlainLyrics } from '../ast/index.js';
import type { VerseNode } from '../ast/interfaces/index.js';
import { stanzaMetrics, verseMetrics } from './index.js';

function firstVerse(source: string, annotated = true): VerseNode {
    const song = annotated ? parseLyrics(source) : parsePlainLyrics(source);
    return song.stanzas[0].verses[0];
}

/** Notes rendered as text, with "‿" wherever a marker is fusing two parts. */
function render(verse: VerseNode): string[] {
    return verseMetrics(verse).notes.map(note =>
        note.parts.map(part => (part.tie === null ? part.text : `‿${part.text}`)).join('')
    );
}

describe('verseMetrics', () => {
    it('turns each plain syllable separator into its own note', (t: it.TestContext) => {
        t.assert.deepStrictEqual(render(firstVerse('# T\nka-ka-ri-ko\n')), ['ka', 'ka', 'ri', 'ko']);
    });

    it('fuses a diéresis-off ("_") into a single note, splitting it when active ("+")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(render(firstVerse('# T\ntri-fu_er-za\n')), ['tri', 'fu‿er', 'za']);
        t.assert.deepStrictEqual(render(firstVerse('# T\ntri-fu+er-za\n')), ['tri', 'fu', 'er', 'za']);
    });

    it('fuses a sinéresis-on ("%") and splits a sinéresis-off ("/")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(render(firstVerse('# T\npo%e-ta\n')), ['po‿e', 'ta']);
        t.assert.deepStrictEqual(render(firstVerse('# T\npo/e-ta\n')), ['po', 'e', 'ta']);
    });

    it('fuses two words across an active sinalefa ("&"), but not across "|" nor a space', (t: it.TestContext) => {
        t.assert.deepStrictEqual(render(firstVerse('# T\nsa-lí&a\n')), ['sa', 'lí‿a']);
        t.assert.deepStrictEqual(render(firstVerse('# T\nsa-lí|a\n')), ['sa', 'lí', 'a']);
        t.assert.deepStrictEqual(render(firstVerse('# T\nsa-lí a\n')), ['sa', 'lí', 'a']);
    });

    it('keeps the internal marker at the right offset on synthetic zero-length tokens', (t: it.TestContext) => {
        t.assert.deepStrictEqual(render(firstVerse('trifuerza\n', false)), ['tri', 'fu‿er', 'za']);
    });

    it('reports the boundary marker between two notes, and null where nothing is alterable', (t: it.TestContext) => {
        // "ka-ko|a me": syllable separator (fixed), sinalefa (alterable), space (fixed).
        const { boundaries } = verseMetrics(firstVerse('# T\nka-ko|a me\n'));
        t.assert.deepStrictEqual(
            boundaries.map(boundary => boundary.marker?.kind ?? null),
            [null, 'sinalefa', null]
        );
    });

    it('flags which boundaries separate two different words', (t: it.TestContext) => {
        const { boundaries } = verseMetrics(firstVerse('# T\nka-ko|a me\n'));
        t.assert.deepStrictEqual(boundaries.map(boundary => boundary.word), [false, true, true]);
    });

    describe('count / min / max', () => {
        it('spans every alterable marker of the verse', (t: it.TestContext) => {
            // 17 syllables; of the 7 word boundaries only 3 put a vowel next to
            // a vowel ("salí a", "kakariko y", "tuve un"), and parsePlainLyrics
            // leaves them off, so count === max.
            const { count, min, max } = verseMetrics(
                firstVerse('Anoche salí a kakariko y tuve un descontrol\n', false)
            );
            t.assert.deepStrictEqual({ count, min, max }, { count: 17, min: 14, max: 17 });
        });

        it('moves `count` inside the range as markers are toggled', (t: it.TestContext) => {
            const verse = firstVerse('# T\nsa-lí&a des-con-trol\n');
            const { count, min, max } = verseMetrics(verse);
            t.assert.deepStrictEqual({ count, min, max }, { count: 5, min: 5, max: 6 });

            verse.words[0].trailingJoin!.active = false;
            t.assert.strictEqual(verseMetrics(verse).count, 6);
        });

        it('ignores plain separators, which are not alterable', (t: it.TestContext) => {
            const { min, max } = verseMetrics(firstVerse('# T\nka-ka-ri-ko\n'));
            t.assert.deepStrictEqual({ min, max }, { min: 4, max: 4 });
        });

        it('is 0/0/0 on an empty verse', (t: it.TestContext) => {
            const { notes, count, min, max } = verseMetrics({
                comments: [],
                words: [],
                range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
            });
            t.assert.deepStrictEqual({ notes, count, min, max }, { notes: [], count: 0, min: 0, max: 0 });
        });
    });
});

describe('stanzaMetrics', () => {
    it('reports the extremes across every verse of the stanza', (t: it.TestContext) => {
        const song = parsePlainLyrics('Anoche salí a kakariko y tuve un descontrol\nWooh\n');
        const { verses, min, max } = stanzaMetrics(song.stanzas[0]);

        t.assert.deepStrictEqual(verses.map(verse => verse.count), [17, 2]);
        t.assert.deepStrictEqual({ min, max }, { min: 1, max: 17 });
    });

    it('is 0/0 on a stanza without verses', (t: it.TestContext) => {
        const { verses, min, max } = stanzaMetrics({
            title: null,
            metadata: emptyStanzaMetadata(),
            comments: [],
            verses: [],
            range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
        });
        t.assert.deepStrictEqual({ verses, min, max }, { verses: [], min: 0, max: 0 });
    });
});
