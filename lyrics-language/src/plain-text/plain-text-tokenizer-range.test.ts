import { describe, it } from 'node:test';
import { parsePlainLyrics } from '../ast/index.js';
import type { Range } from '../ast/interfaces/index.js';

const r = (startLine: number, startColumn: number, endLine: number, endColumn: number): Range => ({
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn }
});

describe('tokenizePlainLyrics range tracking (via parsePlainLyrics)', () => {
    it('a zero-width boundary marker does not widen the syllable it closes ("ahora" -> a-ho-ra)', (t: it.TestContext) => {
        const song = parsePlainLyrics('ahora\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            {
                text: 'a',
                internalMarker: null,
                boundary: { kind: 'synaeresis', active: false, range: r(1, 2, 1, 2) },
                range: r(1, 1, 1, 2)
            },
            { text: 'ho', internalMarker: null, boundary: 'separator', range: r(1, 2, 1, 4) },
            { text: 'ra', internalMarker: null, boundary: null, range: r(1, 4, 1, 6) }
        ]);
    });

    it('a zero-width internal marker (diéresis-off) sits at the split point, inside the fused syllable ("tiempo" -> tiem-po)', (t: it.TestContext) => {
        const song = parsePlainLyrics('tiempo\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            {
                text: 'tiem',
                internalMarker: { kind: 'diaeresis', active: false, range: r(1, 3, 1, 3) },
                boundary: 'separator',
                range: r(1, 1, 1, 5)
            },
            { text: 'po', internalMarker: null, boundary: null, range: r(1, 5, 1, 7) }
        ]);
    });

    it('resets the column to 1 on a new line, across a verse break', (t: it.TestContext) => {
        const song = parsePlainLyrics('sol\nluz\n');
        const [verse1, verse2] = song.stanzas[0].verses;

        t.assert.deepStrictEqual(verse1.words[0].range, r(1, 1, 1, 4));
        t.assert.deepStrictEqual(verse2.words[0].range, r(2, 1, 2, 4));
    });
});
