import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseLyrics, parsePlainLyrics, LyricsParseError } from './index.js';

/**
 * Mechanically derives the plain-text equivalent of an already-annotated
 * `.lyrics` source: strips syllable/diéresis/sinéresis symbols, turns both
 * sinalefa symbols (`&`/`|`) back into a plain space, and leaves `\n`, `#`/`##` titles,
 * and `//` comments untouched (comment TEXT is preserved verbatim, so the
 * strip only ever runs on the part of a line before its `//`, if any).
 */
function toPlainText(annotated: string): string {
    return annotated
        .split('\n')
        .map(line => {
            const commentIdx = line.indexOf('//');
            const content = commentIdx === -1 ? line : line.slice(0, commentIdx);
            const comment = commentIdx === -1 ? '' : line.slice(commentIdx);
            const plainContent = content.replace(/[-+_%]/g, '').replace(/\//g, '').replace(/[&|]/g, ' ');
            return plainContent + comment;
        })
        .join('\n');
}

describe('parsePlainLyrics', () => {
    it('parses a title, a stanza title, and a comment from unannotated text', (t: it.TestContext) => {
        const song = parsePlainLyrics('# Canción\n// nota\n## Estrofa\nhola\n');

        t.assert.strictEqual(song.title?.text, 'Canción');
        t.assert.strictEqual(song.stanzas[0].title?.text, 'Estrofa');
        t.assert.deepStrictEqual(song.stanzas[0].comments.map(c => c.text), ['nota']);
        t.assert.deepStrictEqual(song.stanzas[0].verses[0].words[0].syllables.map(s => s.text), ['ho', 'la']);
    });

    it('reuses parseSong\'s structural validation for free (e.g. two song titles)', (t: it.TestContext) => {
        t.assert.throws(() => parsePlainLyrics('# A\n# B\n'), LyricsParseError);
    });

    describe('metadata', () => {
        it('reads a header block written literally, in both scopes', (t: it.TestContext) => {
            const song = parsePlainLyrics([
                '# Torquemada',
                'artist: Avalanch',
                'albumYear: 1999',
                '',
                '## Coro',
                'desiredLength: 8',
                'hola',
                ''
            ].join('\n'));

            t.assert.strictEqual(song.metadata.artist?.value, 'Avalanch');
            t.assert.strictEqual(song.metadata.albumYear?.value, 1999);
            t.assert.strictEqual(song.stanzas[0].metadata.desiredLength?.value, 8);
        });

        it('keeps a value verbatim instead of dropping its punctuation like a verse does', (t: it.TestContext) => {
            const song = parsePlainLyrics('album: Vol. II: 2 Héroes & 1 Cucco\nhola\n');

            t.assert.strictEqual(song.metadata.album?.value, 'Vol. II: 2 Héroes & 1 Cucco');
        });

        it('does not syllabify a metadata key or value', (t: it.TestContext) => {
            const song = parsePlainLyrics('artist: Avalanch\nhola\n');

            t.assert.strictEqual(song.metadata.artist?.value, 'Avalanch');
        });

        it('leaves a ":" inside an ordinary verse meaningless, as before', (t: it.TestContext) => {
            const song = parsePlainLyrics('hola\nque: tal\n');

            t.assert.strictEqual(song.stanzas[0].verses.length, 2);
            t.assert.deepStrictEqual(
                song.stanzas[0].verses[1].words.map(w => w.syllables.map(s => s.text).join('')),
                ['que', 'tal']
            );
        });

        it('reopens the header at each stanza, so a late verse-like colon stays inert', (t: it.TestContext) => {
            const song = parsePlainLyrics('hola\n\n## Coro\ndesiredLength: 8\nadios\n');

            t.assert.strictEqual(song.stanzas[0].metadata.desiredLength, null);
            t.assert.strictEqual(song.stanzas[1].metadata.desiredLength?.value, 8);
        });
    });

    it('parses the delirio-en-hyrule fixture\'s plain-text equivalent to the same syllable structure as its hand-annotated original', async (t: it.TestContext) => {
        const fixturePath = fileURLToPath(new URL('../../fixtures/delirio-en-hyrule.lyrics', import.meta.url));
        const annotated = await readFile(fixturePath, 'utf-8');
        const plain = toPlainText(annotated);

        const annotatedSong = parseLyrics(annotated);
        const plainSong = parsePlainLyrics(plain);

        t.assert.strictEqual(plainSong.title?.text, annotatedSong.title?.text);
        t.assert.deepStrictEqual(plainSong.comments.map(c => c.text), annotatedSong.comments.map(c => c.text));
        t.assert.strictEqual(plainSong.stanzas.length, annotatedSong.stanzas.length);

        for (let s = 0; s < annotatedSong.stanzas.length; s++) {
            const annotatedStanza = annotatedSong.stanzas[s];
            const plainStanza = plainSong.stanzas[s];

            t.assert.strictEqual(plainStanza.title?.text, annotatedStanza.title?.text);
            t.assert.deepStrictEqual(
                plainStanza.comments.map(c => c.text),
                annotatedStanza.comments.map(c => c.text)
            );
            t.assert.strictEqual(plainStanza.verses.length, annotatedStanza.verses.length);

            for (let v = 0; v < annotatedStanza.verses.length; v++) {
                const annotatedVerse = annotatedStanza.verses[v];
                const plainVerse = plainStanza.verses[v];

                t.assert.deepStrictEqual(
                    plainVerse.comments.map(c => c.text),
                    annotatedVerse.comments.map(c => c.text)
                );
                t.assert.strictEqual(
                    plainVerse.words.length, annotatedVerse.words.length,
                    `stanza ${s} verse ${v}: word count differs`
                );

                for (let w = 0; w < annotatedVerse.words.length; w++) {
                    const annotatedSyllables = annotatedVerse.words[w].syllables.map(syl => syl.text);
                    const plainSyllables = plainVerse.words[w].syllables.map(syl => syl.text);

                    t.assert.deepStrictEqual(
                        plainSyllables, annotatedSyllables,
                        `stanza ${s} verse ${v} word ${w}: expected [${annotatedSyllables}], got [${plainSyllables}]`
                    );
                }
            }
        }
    });
});
