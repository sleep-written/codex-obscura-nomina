import { describe, it } from 'node:test';

import { parseLyrics } from './index.js';
import { locate } from './locate.js';

describe('locate', () => {
    it('finds a syllable at its position', (t: it.TestContext) => {
        const song = parseLyrics('nie-go\n');
        // "nie" spans columns 1-4 (exclusive), so column 2 is inside it.
        const result = locate(song, { line: 1, column: 2 });

        t.assert.strictEqual(result.kind, 'syllable');
        if (result.kind === 'syllable') {
            t.assert.strictEqual(result.syllable.text, 'nie');
        }
    });

    it('finds the diaeresis-on marker that closes a syllable ("fu+er")', (t: it.TestContext) => {
        const song = parseLyrics('fu+er\n');
        // "+" is the single-char token at column 3.
        const result = locate(song, { line: 1, column: 3 });

        t.assert.strictEqual(result.kind, 'marker');
        if (result.kind === 'marker') {
            t.assert.deepStrictEqual(result.marker, { kind: 'diaeresis', active: true, range: result.marker.range });
        }
    });

    it('finds a trailing comment', (t: it.TestContext) => {
        const song = parseLyrics('nie-go // nota de verso\n');
        // "nota de verso" starts at column 11.
        const result = locate(song, { line: 1, column: 12 });

        t.assert.strictEqual(result.kind, 'comment');
        if (result.kind === 'comment') {
            t.assert.strictEqual(result.comment.text, 'nota de verso');
            t.assert.strictEqual(result.owner, 'verse');
        }
    });

    it('finds the song title', (t: it.TestContext) => {
        const song = parseLyrics('#Song\nnie-go\n');
        const result = locate(song, { line: 1, column: 3 });

        t.assert.strictEqual(result.kind, 'title');
        if (result.kind === 'title') {
            t.assert.strictEqual(result.text, 'Song');
            t.assert.strictEqual(result.owner, 'song');
        }
    });

    it('tells a metadata key apart from its value', (t: it.TestContext) => {
        const song = parseLyrics('artist: Avalanch\nnie-go\n');
        // "artist" spans columns 1-7 (exclusive); "Avalanch" starts at column 9.
        const onKey = locate(song, { line: 1, column: 3 });
        const onValue = locate(song, { line: 1, column: 10 });

        t.assert.strictEqual(onKey.kind, 'metadata');
        if (onKey.kind === 'metadata') {
            t.assert.strictEqual(onKey.part, 'key');
            t.assert.strictEqual(onKey.entry.key, 'artist');
            t.assert.strictEqual(onKey.owner, 'song');
        }

        t.assert.strictEqual(onValue.kind, 'metadata');
        if (onValue.kind === 'metadata') {
            t.assert.strictEqual(onValue.part, 'value');
            t.assert.strictEqual(onValue.entry.value, 'Avalanch');
        }
    });

    it('finds a stanza\'s metadata entry', (t: it.TestContext) => {
        const song = parseLyrics('## Coro\ndesiredLength: 8\nnie-go\n');
        const result = locate(song, { line: 2, column: 2 });

        t.assert.strictEqual(result.kind, 'metadata');
        if (result.kind === 'metadata') {
            t.assert.strictEqual(result.entry.key, 'desiredLength');
            t.assert.strictEqual(result.entry.value, 8);
            t.assert.strictEqual(result.owner, 'stanza');
        }
    });

    it('returns "none" on the ":" separating a key from its value', (t: it.TestContext) => {
        const song = parseLyrics('artist: Avalanch\nnie-go\n');
        t.assert.strictEqual(locate(song, { line: 1, column: 7 }).kind, 'none');
    });

    it('returns "none" for a position outside any node (e.g. past end of file)', (t: it.TestContext) => {
        const song = parseLyrics('nie-go\n');
        const result = locate(song, { line: 99, column: 1 });

        t.assert.strictEqual(result.kind, 'none');
    });
});
