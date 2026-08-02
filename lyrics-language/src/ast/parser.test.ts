import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseLyrics, LyricsParseError } from './index.js';
import type { Range } from './interfaces/index.js';

const r = (startLine: number, startColumn: number, endLine: number, endColumn: number): Range => ({
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn }
});

describe('parseLyrics', () => {
    it('parses a song title, a stanza title, and a syllable-separated word', (t: it.TestContext) => {
        const song = parseLyrics('#Song\n##Stanza\nnie-go\n');

        t.assert.deepStrictEqual(song, {
            title: { text: 'Song', range: r(1, 2, 1, 6) },
            comments: [],
            range: r(1, 1, 3, 7),
            stanzas: [{
                title: { text: 'Stanza', range: r(2, 3, 2, 9) },
                comments: [],
                range: r(2, 1, 3, 7),
                verses: [{
                    comments: [],
                    range: r(3, 1, 3, 7),
                    words: [{
                        trailingJoin: null,
                        range: r(3, 1, 3, 7),
                        syllables: [
                            { text: 'nie', internalMarker: null, boundary: 'separator', range: r(3, 1, 3, 5) },
                            { text: 'go', internalMarker: null, boundary: null, range: r(3, 5, 3, 7) }
                        ]
                    }]
                }]
            }]
        });
    });

    it('creates an untitled stanza when no "##" title precedes the first verse', (t: it.TestContext) => {
        const song = parseLyrics('nie-go\n');

        t.assert.strictEqual(song.title, null);
        t.assert.strictEqual(song.stanzas.length, 1);
        t.assert.strictEqual(song.stanzas[0].title, null);
    });

    it('tracks sinalefa vs. plain word separators as each word\'s trailingJoin', (t: it.TestContext) => {
        const song = parseLyrics('Buscarán|a&otro contratar\n');
        const [word1, word2, word3, word4] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word1.trailingJoin, { kind: 'sinalefa', active: false, range: r(1, 9, 1, 10) });
        t.assert.deepStrictEqual(word2.trailingJoin, { kind: 'sinalefa', active: true, range: r(1, 11, 1, 12) });
        // A plain space is not an alterable boundary at all, so no marker.
        t.assert.strictEqual(word3.trailingJoin, null);
        t.assert.strictEqual(word4.trailingJoin, null);
    });

    it('resolves diéresis-off as an internal marker, not a syllable boundary ("tri-fu_er-za")', (t: it.TestContext) => {
        const song = parseLyrics('tri-fu_er-za\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            { text: 'tri', internalMarker: null, boundary: 'separator', range: r(1, 1, 1, 5) },
            {
                text: 'fuer',
                internalMarker: { kind: 'diaeresis', active: false, range: r(1, 7, 1, 8) },
                boundary: 'separator',
                range: r(1, 5, 1, 11)
            },
            { text: 'za', internalMarker: null, boundary: null, range: r(1, 11, 1, 13) }
        ]);
    });

    it('resolves sinéresis-off as a syllable boundary, replacing "-" ("a/ho-ra")', (t: it.TestContext) => {
        const song = parseLyrics('a/ho-ra\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            {
                text: 'a',
                internalMarker: null,
                boundary: { kind: 'synaeresis', active: false, range: r(1, 2, 1, 3) },
                range: r(1, 1, 1, 3)
            },
            { text: 'ho', internalMarker: null, boundary: 'separator', range: r(1, 3, 1, 6) },
            { text: 'ra', internalMarker: null, boundary: null, range: r(1, 6, 1, 8) }
        ]);
    });

    it('resolves diéresis-on as a syllable boundary ("fu+er")', (t: it.TestContext) => {
        const song = parseLyrics('fu+er\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            {
                text: 'fu',
                internalMarker: null,
                boundary: { kind: 'diaeresis', active: true, range: r(1, 3, 1, 4) },
                range: r(1, 1, 1, 4)
            },
            { text: 'er', internalMarker: null, boundary: null, range: r(1, 4, 1, 6) }
        ]);
    });

    describe('comments', () => {
        it('attaches a standalone comment as a leading comment of the stanza that follows it', (t: it.TestContext) => {
            const song = parseLyrics('// nota de estrofa\n##Estrofa\nnie-go\n');

            t.assert.deepStrictEqual(song.stanzas[0].comments, [
                { text: 'nota de estrofa', range: r(1, 4, 1, 19) }
            ]);
        });

        it('attaches a trailing comment to the verse it sits on', (t: it.TestContext) => {
            const song = parseLyrics('nie-go // nota de verso\n');

            t.assert.deepStrictEqual(song.stanzas[0].verses[0].comments, [
                { text: 'nota de verso', range: r(1, 11, 1, 24) }
            ]);
        });

        it('attaches a comment between two stanzas as a leading comment of the next stanza', (t: it.TestContext) => {
            const song = parseLyrics('nie-go\n\n// nota\n##Coro\nla-la\n');

            t.assert.deepStrictEqual(song.stanzas[1].title, { text: 'Coro', range: r(4, 3, 4, 7) });
            t.assert.deepStrictEqual(song.stanzas[1].comments, [{ text: 'nota', range: r(3, 4, 3, 8) }]);
        });

        it('attaches a comment dangling at the end of the file to the last verse', (t: it.TestContext) => {
            const song = parseLyrics('nie-go\n// nota final\n');
            const lastStanza = song.stanzas[song.stanzas.length - 1];
            const lastVerse = lastStanza.verses[lastStanza.verses.length - 1];

            t.assert.deepStrictEqual(lastVerse.comments, [{ text: 'nota final', range: r(2, 4, 2, 14) }]);
        });
    });

    describe('errors', () => {
        it('rejects an unknown character inside a word', (t: it.TestContext) => {
            t.assert.throws(() => parseLyrics('nie,go\n'), LyricsParseError);
        });

        it('rejects a word that starts with a syllable separator', (t: it.TestContext) => {
            t.assert.throws(() => parseLyrics('-nie\n'), LyricsParseError);
        });

        it('rejects a sinalefa immediately followed by a space (an empty word)', (t: it.TestContext) => {
            t.assert.throws(() => parseLyrics('a& b\n'), LyricsParseError);
        });

        it('rejects a song title marker that appears after content has started', (t: it.TestContext) => {
            t.assert.throws(() => parseLyrics('nie-go\n#Song\n'), LyricsParseError);
        });
    });

    it('parses the delirio-en-hyrule fixture end to end', async (t: it.TestContext) => {
        const fixturePath = fileURLToPath(new URL('../../fixtures/delirio-en-hyrule.lyrics', import.meta.url));
        const source = await readFile(fixturePath, 'utf-8');
        const song = parseLyrics(source);

        t.assert.deepStrictEqual(song.title, { text: 'Delirio en Hyrule', range: r(2, 3, 2, 20) });
        t.assert.deepStrictEqual(song.comments, [
            { text: 'fixture de prueba para el tokenizer y el parser de AST', range: r(1, 4, 1, 58) }
        ]);
        t.assert.strictEqual(song.stanzas.length, 2);

        t.assert.strictEqual(song.stanzas[0].title, null);
        t.assert.strictEqual(song.stanzas[0].verses.length, 4);
        t.assert.deepStrictEqual(
            song.stanzas[0].verses[1].comments,
            [{ text: 'nombres propios sin acentuar', range: r(4, 50, 4, 78) }]
        );

        t.assert.deepStrictEqual(song.stanzas[1].title, { text: 'Coro Cósmico', range: r(9, 4, 9, 16) });
        t.assert.deepStrictEqual(song.stanzas[1].comments, [
            { text: 'segunda estrofa: el coro', range: r(8, 4, 8, 28) }
        ]);
        t.assert.strictEqual(song.stanzas[1].verses.length, 2);
    });
});
