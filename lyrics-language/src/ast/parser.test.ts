import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseLyrics, LyricsParseError, emptySongMetadata, emptyStanzaMetadata } from './index.js';
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
            metadata: emptySongMetadata(),
            comments: [],
            range: r(1, 1, 3, 7),
            stanzas: [{
                title: { text: 'Stanza', range: r(2, 3, 2, 9) },
                metadata: emptyStanzaMetadata(),
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

    describe('metadata', () => {
        it('parses the song header keys, typing numeric ones as numbers', (t: it.TestContext) => {
            const song = parseLyrics([
                '# Torquemada',
                'artist: Avalanch',
                'album: Llanto De Un Héroe',
                'albumArtist: Avalanch',
                'albumYear: 1999',
                'trackNumber: 2',
                'La|i-gle-si_a',
                ''
            ].join('\n'));

            t.assert.strictEqual(song.metadata.artist?.value, 'Avalanch');
            t.assert.strictEqual(song.metadata.album?.value, 'Llanto De Un Héroe');
            t.assert.strictEqual(song.metadata.albumArtist?.value, 'Avalanch');
            t.assert.strictEqual(song.metadata.albumYear?.value, 1999);
            t.assert.strictEqual(song.metadata.trackNumber?.value, 2);
        });

        it('spans the key and the trimmed value separately', (t: it.TestContext) => {
            const song = parseLyrics('artist: Avalanch\nnie-go\n');

            t.assert.deepStrictEqual(song.metadata.artist, {
                key: 'artist',
                value: 'Avalanch',
                keyRange: r(1, 1, 1, 7),
                valueRange: r(1, 9, 1, 17),
                range: r(1, 1, 1, 17)
            });
        });

        it('keeps a value verbatim, including its punctuation, digits and further colons', (t: it.TestContext) => {
            const song = parseLyrics('album: Vol. II: 2 Héroes & 1 Cucco\nnie-go\n');

            t.assert.strictEqual(song.metadata.album?.value, 'Vol. II: 2 Héroes & 1 Cucco');
        });

        it('parses a stanza\'s desiredLength under its title', (t: it.TestContext) => {
            const song = parseLyrics('## Coro\ndesiredLength: 8\nnie-go\n');

            t.assert.strictEqual(song.stanzas[0].metadata.desiredLength?.value, 8);
            t.assert.strictEqual(song.metadata.artist, null);
        });

        it('opens an untitled stanza when a stanza key arrives with no stanza started', (t: it.TestContext) => {
            const song = parseLyrics('nie-go\n\ndesiredLength: 8\nla-la\n');

            t.assert.strictEqual(song.stanzas.length, 2);
            t.assert.strictEqual(song.stanzas[1].title, null);
            t.assert.strictEqual(song.stanzas[1].metadata.desiredLength?.value, 8);
            t.assert.strictEqual(song.stanzas[1].verses.length, 1);
        });

        it('attaches a metadata line\'s own comments to the header that owns it', (t: it.TestContext) => {
            const song = parseLyrics('// del disco\nartist: Avalanch // la banda\nnie-go\n');

            t.assert.deepStrictEqual(song.comments.map(c => c.text), ['del disco', 'la banda']);
        });

        describe('errors', () => {
            it('rejects an unknown key', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('artista: Avalanch\nnie-go\n'), LyricsParseError);
            });

            it('rejects a non-numeric value on a numeric key', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('albumYear: mil\nnie-go\n'), LyricsParseError);
                t.assert.throws(() => parseLyrics('trackNumber: 2b\nnie-go\n'), LyricsParseError);
            });

            it('rejects an empty value', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('artist:\nnie-go\n'), LyricsParseError);
                t.assert.throws(() => parseLyrics('artist:   \nnie-go\n'), LyricsParseError);
            });

            it('rejects a repeated key in the same header', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('artist: A\nartist: B\nnie-go\n'), LyricsParseError);
                t.assert.throws(
                    () => parseLyrics('## Coro\ndesiredLength: 8\ndesiredLength: 9\nnie-go\n'),
                    LyricsParseError
                );
            });

            it('rejects a song key below the first stanza', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('nie-go\n\nartist: Avalanch\n'), LyricsParseError);
            });

            it('rejects a stanza key below its stanza\'s first verse', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('## Coro\nnie-go\ndesiredLength: 8\n'), LyricsParseError);
            });

            it('rejects a song title below the metadata block', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('artist: Avalanch\n# Torquemada\nnie-go\n'), LyricsParseError);
            });

            it('still rejects a bare ":" inside a verse', (t: it.TestContext) => {
                t.assert.throws(() => parseLyrics('## Coro\nnie-go\nla:la\n'), LyricsParseError);
            });
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
            { text: 'fixture de prueba para el tokenizer y el parser de AST', range: r(1, 4, 1, 58) },
            { text: 'datos del disco', range: r(3, 4, 3, 19) },
            { text: 'remasterizado en 2011', range: r(7, 20, 7, 41) }
        ]);

        t.assert.deepStrictEqual(song.metadata.artist, {
            key: 'artist',
            value: 'Los Cuccos Vengativos',
            keyRange: r(4, 1, 4, 7),
            valueRange: r(4, 9, 4, 30),
            range: r(4, 1, 4, 30)
        });
        t.assert.deepStrictEqual(song.metadata.albumYear, {
            key: 'albumYear',
            value: 1998,
            keyRange: r(7, 1, 7, 10),
            valueRange: r(7, 12, 7, 16),
            range: r(7, 1, 7, 16)
        });
        t.assert.strictEqual(song.metadata.trackNumber?.value, 7);
        t.assert.strictEqual(song.metadata.album?.value, 'Ocarina del Descontrol');
        t.assert.strictEqual(song.metadata.albumArtist?.value, 'Los Cuccos Vengativos');

        t.assert.strictEqual(song.stanzas.length, 2);

        t.assert.strictEqual(song.stanzas[0].title, null);
        t.assert.strictEqual(song.stanzas[0].metadata.desiredLength, null);
        t.assert.strictEqual(song.stanzas[0].verses.length, 4);
        t.assert.deepStrictEqual(
            song.stanzas[0].verses[1].comments,
            [{ text: 'nombres propios sin acentuar', range: r(10, 50, 10, 78) }]
        );

        t.assert.deepStrictEqual(song.stanzas[1].title, { text: 'Coro Cósmico', range: r(15, 4, 15, 16) });
        t.assert.deepStrictEqual(song.stanzas[1].metadata.desiredLength, {
            key: 'desiredLength',
            value: 12,
            keyRange: r(16, 1, 16, 14),
            valueRange: r(16, 16, 16, 18),
            range: r(16, 1, 16, 18)
        });
        t.assert.deepStrictEqual(song.stanzas[1].comments, [
            { text: 'segunda estrofa: el coro', range: r(14, 4, 14, 28) }
        ]);
        t.assert.strictEqual(song.stanzas[1].verses.length, 2);
    });
});
