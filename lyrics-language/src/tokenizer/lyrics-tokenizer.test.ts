import { describe, it } from 'node:test';
import { lyricsTokenizer } from './lyrics-tokenizer.js';

describe('lyricsTokenizer', () => {
    it('splits a word and a syllable separator ("nie-go")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('nie-go');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',                value: 'nie', line: 1, column: 1, length: 3 },
            { type: 'syllable-separator',   value: '-',   line: 1, column: 4, length: 1 },
            { type: 'text',                value: 'go',  line: 1, column: 5, length: 2 }
        ]);
    });

    it('splits words by a word separator ("a otro")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a otro');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',            value: 'a',    line: 1, column: 1, length: 1 },
            { type: 'word-separator',  value: ' ',    line: 1, column: 2, length: 1 },
            { type: 'text',            value: 'otro', line: 1, column: 3, length: 4 }
        ]);
    });

    it('recognizes an activated sinalefa in place of the space ("a&otro")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a&otro');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',        value: 'a',    line: 1, column: 1, length: 1 },
            { type: 'sinalefa-on', value: '&',    line: 1, column: 2, length: 1 },
            { type: 'text',        value: 'otro', line: 1, column: 3, length: 4 }
        ]);
    });

    it('recognizes a deactivated sinalefa in place of the space ("a|otro")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a|otro');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',         value: 'a',    line: 1, column: 1, length: 1 },
            { type: 'sinalefa-off', value: '|',    line: 1, column: 2, length: 1 },
            { type: 'text',         value: 'otro', line: 1, column: 3, length: 4 }
        ]);
    });

    it('recognizes diéresis and sinéresis markers ("+_" and "%/")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(lyricsTokenizer.tokenize('+_'), [
            { type: 'diaeresis-on',  value: '+', line: 1, column: 1, length: 1 },
            { type: 'diaeresis-off', value: '_', line: 1, column: 2, length: 1 }
        ]);

        t.assert.deepStrictEqual(lyricsTokenizer.tokenize('%/'), [
            { type: 'synaeresis-on',  value: '%', line: 1, column: 1, length: 1 },
            { type: 'synaeresis-off', value: '/', line: 1, column: 2, length: 1 }
        ]);
    });

    it('recognizes a song title ("#Título")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('#Título');
        t.assert.deepStrictEqual(tokens, [
            { type: 'song-title-marker', value: '#',      line: 1, column: 1, length: 1 },
            { type: 'text',              value: 'Título', line: 1, column: 2, length: 6 }
        ]);
    });

    it('recognizes a stanza title ("##Título")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('##Título');
        t.assert.deepStrictEqual(tokens, [
            { type: 'stanza-title-marker', value: '##',     line: 1, column: 1, length: 2 },
            { type: 'text',                value: 'Título', line: 1, column: 3, length: 6 }
        ]);
    });

    it('recognizes a standalone comment ("// nota suelta\\nb")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('// nota suelta\nb');
        t.assert.deepStrictEqual(tokens, [
            { type: 'comment',   value: '// nota suelta', line: 1, column: 1,  length: 14 },
            { type: 'verse-end', value: '\n',              line: 1, column: 15, length: 1 },
            { type: 'text',      value: 'b',                line: 2, column: 1,  length: 1 }
        ]);
    });

    it('recognizes a trailing comment after content ("a-ho-ra // nota")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a-ho-ra // nota');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',               value: 'a',        line: 1, column: 1,  length: 1 },
            { type: 'syllable-separator', value: '-',        line: 1, column: 2,  length: 1 },
            { type: 'text',               value: 'ho',       line: 1, column: 3,  length: 2 },
            { type: 'syllable-separator', value: '-',        line: 1, column: 5,  length: 1 },
            { type: 'text',               value: 'ra',       line: 1, column: 6,  length: 2 },
            { type: 'word-separator',     value: ' ',        line: 1, column: 8,  length: 1 },
            { type: 'comment',            value: '// nota',  line: 1, column: 9,  length: 7 }
        ]);
    });

    it('does not confuse a lone synaeresis-off slash with a comment ("a/ho-ra")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a/ho-ra');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',               value: 'a',   line: 1, column: 1, length: 1 },
            { type: 'synaeresis-off',     value: '/',   line: 1, column: 2, length: 1 },
            { type: 'text',               value: 'ho',  line: 1, column: 3, length: 2 },
            { type: 'syllable-separator', value: '-',   line: 1, column: 5, length: 1 },
            { type: 'text',               value: 'ra',  line: 1, column: 6, length: 2 }
        ]);
    });

    it('a single newline is a verse-end ("a\\nb")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a\nb');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',      value: 'a',  line: 1, column: 1, length: 1 },
            { type: 'verse-end', value: '\n', line: 1, column: 2, length: 1 },
            { type: 'text',      value: 'b',  line: 2, column: 1, length: 1 }
        ]);
    });

    it('two or more consecutive newlines collapse into a single stanza-end ("a\\n\\n\\nb")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('a\n\n\nb');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',       value: 'a',     line: 1, column: 1, length: 1 },
            { type: 'stanza-end', value: '\n\n\n', line: 1, column: 2, length: 3 },
            { type: 'text',       value: 'b',     line: 4, column: 1, length: 1 }
        ]);
    });

    it('classifies anything else as unknown (e.g. digits, punctuation: "3,")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('3,');
        t.assert.deepStrictEqual(tokens, [
            { type: 'unknown', value: '3,', line: 1, column: 1, length: 2 }
        ]);
    });

    it('recognizes a metadata separator, keeping it out of "unknown" ("albumYear: 1999")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('albumYear: 1999');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text', value: 'albumYear', line: 1, column: 1, length: 9 },
            { type: 'metadata-separator', value: ':', line: 1, column: 10, length: 1 },
            { type: 'word-separator', value: ' ', line: 1, column: 11, length: 1 },
            { type: 'unknown', value: '1999', line: 1, column: 12, length: 4 }
        ]);
    });

    it('tokenizes a full verso with an explicit sinalefa ("Buscarán a&otro contratar")', (t: it.TestContext) => {
        const tokens = lyricsTokenizer.tokenize('Buscarán a&otro contratar');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',            value: 'Buscarán',  line: 1, column: 1,  length: 8 },
            { type: 'word-separator',  value: ' ',         line: 1, column: 9,  length: 1 },
            { type: 'text',            value: 'a',         line: 1, column: 10, length: 1 },
            { type: 'sinalefa-on',     value: '&',         line: 1, column: 11, length: 1 },
            { type: 'text',            value: 'otro',      line: 1, column: 12, length: 4 },
            { type: 'word-separator',  value: ' ',         line: 1, column: 16, length: 1 },
            { type: 'text',            value: 'contratar', line: 1, column: 17, length: 9 }
        ]);
    });
});
