import { describe, it } from 'node:test';

import { parseLyrics } from './index.js';
import type { Range } from './interfaces/index.js';

const r = (startLine: number, startColumn: number, endLine: number, endColumn: number): Range => ({
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn }
});

describe('parseLyrics ranges', () => {
    it('extends SongNode.range across every stanza when there is no song title', (t: it.TestContext) => {
        const song = parseLyrics('nie-go\n\nla-la\n');

        t.assert.deepStrictEqual(song.range, r(1, 1, 3, 6));
        t.assert.strictEqual(song.stanzas.length, 2);
    });

    it('keeps SongNode.range.start at the title marker when a song title is present', (t: it.TestContext) => {
        const song = parseLyrics('#Song\nnie-go\n');

        t.assert.deepStrictEqual(song.range, r(1, 1, 2, 7));
    });

    it('extends StanzaNode.range across every verse it contains', (t: it.TestContext) => {
        const song = parseLyrics('##Coro\nnie-go\nla-la\n');

        t.assert.deepStrictEqual(song.stanzas[0].range, r(1, 1, 3, 6));
        t.assert.strictEqual(song.stanzas[0].verses.length, 2);
    });

    it('trims edge whitespace out of a multi-word title range ("# Delirio en Hyrule")', (t: it.TestContext) => {
        const song = parseLyrics('# Delirio en Hyrule\nnie-go\n');

        t.assert.deepStrictEqual(song.title, { text: 'Delirio en Hyrule', range: r(1, 3, 1, 20) });
    });

    it('computes a VerseNode.range spanning its first to its last word', (t: it.TestContext) => {
        const song = parseLyrics('Buscarán a&otro contratar\n');

        t.assert.deepStrictEqual(song.stanzas[0].verses[0].range, r(1, 1, 1, 26));
    });
});
