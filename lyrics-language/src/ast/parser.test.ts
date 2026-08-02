import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseLyrics, LyricsParseError } from './index.js';

describe('parseLyrics', () => {
    it('parses a song title, a stanza title, and a syllable-separated word', (t: it.TestContext) => {
        const song = parseLyrics('#Song\n##Stanza\nnie-go\n');

        t.assert.deepStrictEqual(song, {
            title: 'Song',
            comments: [],
            stanzas: [{
                title: 'Stanza',
                comments: [],
                verses: [{
                    comments: [],
                    words: [{
                        trailingJoin: null,
                        syllables: [
                            { text: 'nie', internalMarker: null, boundary: 'separator' },
                            { text: 'go', internalMarker: null, boundary: null }
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
        const song = parseLyrics('Buscarán a&otro contratar\n');
        const [word1, word2, word3, word4] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word1.trailingJoin, { kind: 'sinalefa', active: false });
        t.assert.deepStrictEqual(word2.trailingJoin, { kind: 'sinalefa', active: true });
        t.assert.deepStrictEqual(word3.trailingJoin, { kind: 'sinalefa', active: false });
        t.assert.strictEqual(word4.trailingJoin, null);
    });

    it('resolves diéresis-off as an internal marker, not a syllable boundary ("tri-fu_er-za")', (t: it.TestContext) => {
        const song = parseLyrics('tri-fu_er-za\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            { text: 'tri', internalMarker: null, boundary: 'separator' },
            { text: 'fuer', internalMarker: { kind: 'diaeresis', active: false }, boundary: 'separator' },
            { text: 'za', internalMarker: null, boundary: null }
        ]);
    });

    it('resolves sinéresis-off as a syllable boundary, replacing "-" ("a/ho-ra")', (t: it.TestContext) => {
        const song = parseLyrics('a/ho-ra\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            { text: 'a', internalMarker: null, boundary: { kind: 'synaeresis', active: false } },
            { text: 'ho', internalMarker: null, boundary: 'separator' },
            { text: 'ra', internalMarker: null, boundary: null }
        ]);
    });

    it('resolves diéresis-on as a syllable boundary ("fu+er")', (t: it.TestContext) => {
        const song = parseLyrics('fu+er\n');
        const [word] = song.stanzas[0].verses[0].words;

        t.assert.deepStrictEqual(word.syllables, [
            { text: 'fu', internalMarker: null, boundary: { kind: 'diaeresis', active: true } },
            { text: 'er', internalMarker: null, boundary: null }
        ]);
    });

    describe('comments', () => {
        it('attaches a standalone comment as a leading comment of the stanza that follows it', (t: it.TestContext) => {
            const song = parseLyrics('// nota de estrofa\n##Estrofa\nnie-go\n');

            t.assert.deepStrictEqual(song.stanzas[0].comments, ['nota de estrofa']);
        });

        it('attaches a trailing comment to the verse it sits on', (t: it.TestContext) => {
            const song = parseLyrics('nie-go // nota de verso\n');

            t.assert.deepStrictEqual(song.stanzas[0].verses[0].comments, ['nota de verso']);
        });

        it('attaches a comment between two stanzas as a leading comment of the next stanza', (t: it.TestContext) => {
            const song = parseLyrics('nie-go\n\n// nota\n##Coro\nla-la\n');

            t.assert.deepStrictEqual(song.stanzas[1].title, 'Coro');
            t.assert.deepStrictEqual(song.stanzas[1].comments, ['nota']);
        });

        it('attaches a comment dangling at the end of the file to the last verse', (t: it.TestContext) => {
            const song = parseLyrics('nie-go\n// nota final\n');
            const lastStanza = song.stanzas[song.stanzas.length - 1];
            const lastVerse = lastStanza.verses[lastStanza.verses.length - 1];

            t.assert.deepStrictEqual(lastVerse.comments, ['nota final']);
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

        t.assert.strictEqual(song.title, 'Delirio en Hyrule');
        t.assert.deepStrictEqual(song.comments, ['fixture de prueba para el tokenizer y el parser de AST']);
        t.assert.strictEqual(song.stanzas.length, 2);

        t.assert.strictEqual(song.stanzas[0].title, null);
        t.assert.strictEqual(song.stanzas[0].verses.length, 4);
        t.assert.deepStrictEqual(
            song.stanzas[0].verses[1].comments,
            ['nombres propios sin acentuar']
        );

        t.assert.strictEqual(song.stanzas[1].title, 'Coro Cósmico');
        t.assert.deepStrictEqual(song.stanzas[1].comments, ['segunda estrofa: el coro']);
        t.assert.strictEqual(song.stanzas[1].verses.length, 2);
    });
});
