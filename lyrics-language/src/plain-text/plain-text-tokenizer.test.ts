import { describe, it } from 'node:test';
import { tokenizePlainLyrics } from './plain-text-tokenizer.js';

describe('tokenizePlainLyrics', () => {
    it('translates a single word into the same token sequence its annotated equivalent would produce ("ahora" -> a/ho-ra)', (t: it.TestContext) => {
        t.assert.deepStrictEqual(tokenizePlainLyrics('ahora'), [
            { type: 'text', value: 'a', line: 1, column: 1, length: 1 },
            { type: 'synaeresis-off', value: '/', line: 1, column: 2, length: 0 },
            { type: 'text', value: 'ho', line: 1, column: 2, length: 2 },
            { type: 'syllable-separator', value: '-', line: 1, column: 4, length: 0 },
            { type: 'text', value: 'ra', line: 1, column: 4, length: 2 }
        ]);
    });

    it('marks a vowel-to-vowel word boundary as an alterable sinalefa, but leaves it off ("la ola")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(tokenizePlainLyrics('la ola'), [
            { type: 'text', value: 'la', line: 1, column: 1, length: 2 },
            { type: 'sinalefa-off', value: '|', line: 1, column: 3, length: 1 },
            { type: 'text', value: 'o', line: 1, column: 4, length: 1 },
            { type: 'syllable-separator', value: '-', line: 1, column: 5, length: 0 },
            { type: 'text', value: 'la', line: 1, column: 5, length: 2 }
        ]);
    });

    it('leaves a boundary where no vowel meets a vowel as a plain separator ("que me")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(tokenizePlainLyrics('que me'), [
            { type: 'text', value: 'que', line: 1, column: 1, length: 3 },
            { type: 'word-separator', value: ' ', line: 1, column: 4, length: 1 },
            { type: 'text', value: 'me', line: 1, column: 5, length: 2 }
        ]);
    });

    it('sees through a silent "h" ("la hora") and treats a final/lone "y" as a vowel ("hoy es", "y algo")', (t: it.TestContext) => {
        const boundaries = (source: string) => tokenizePlainLyrics(source)
            .filter(tok => tok.type === 'word-separator' || tok.type === 'sinalefa-off')
            .map(tok => tok.type);

        t.assert.deepStrictEqual(boundaries('la hora'), ['sinalefa-off']);
        t.assert.deepStrictEqual(boundaries('hoy es'), ['sinalefa-off']);
        t.assert.deepStrictEqual(boundaries('y algo'), ['sinalefa-off']);
        // "yo" opens on the consonant /ʝ/, not on a vowel.
        t.assert.deepStrictEqual(boundaries('la yema'), ['word-separator']);
    });

    it('does not join across dropped punctuation ("salí, a")', (t: it.TestContext) => {
        const types = tokenizePlainLyrics('salí, a').map(tok => tok.type);
        t.assert.strictEqual(types.includes('sinalefa-off'), false);
    });

    describe('discarded punctuation', () => {
        it('drops surrounding "¡"/"!" without affecting the word\'s own syllabification ("¡hola!")', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('¡hola!'), [
                { type: 'text', value: 'ho', line: 1, column: 2, length: 2 },
                { type: 'syllable-separator', value: '-', line: 1, column: 4, length: 0 },
                { type: 'text', value: 'la', line: 1, column: 4, length: 2 }
            ]);
        });

        it('drops a trailing comma, leaving the word intact ("años,")', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('años,'), [
                { type: 'text', value: 'a', line: 1, column: 1, length: 1 },
                { type: 'syllable-separator', value: '-', line: 1, column: 2, length: 0 },
                { type: 'text', value: 'ños', line: 1, column: 2, length: 3 }
            ]);
        });

        it('drops "¿"/"?" around a word with a silenced "u" before an accented vowel ("¿qué?" is monosyllabic)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('¿qué?'), [
                { type: 'text', value: 'qué', line: 1, column: 2, length: 3 }
            ]);
        });

        it('drops a loose DSL symbol typed in plain text instead of interpreting it ("a-b" has no real separator)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('a-b'), [
                { type: 'text', value: 'a', line: 1, column: 1, length: 1 },
                { type: 'text', value: 'b', line: 1, column: 3, length: 1 }
            ]);
        });
    });

    describe('titles and comments, recognized literally like in the annotated DSL', () => {
        it('emits a multi-word song title as unsegmented text tokens, never syllabified', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('# Título\n'), [
                { type: 'song-title-marker', value: '#', line: 1, column: 1, length: 1 },
                { type: 'word-separator', value: ' ', line: 1, column: 2, length: 1 },
                { type: 'text', value: 'Título', line: 1, column: 3, length: 6 },
                { type: 'verse-end', value: '\n', line: 1, column: 9, length: 1 }
            ]);
        });

        it('recognizes "##" as a stanza title marker', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('## Coro\n'), [
                { type: 'stanza-title-marker', value: '##', line: 1, column: 1, length: 2 },
                { type: 'word-separator', value: ' ', line: 1, column: 3, length: 1 },
                { type: 'text', value: 'Coro', line: 1, column: 4, length: 4 },
                { type: 'verse-end', value: '\n', line: 1, column: 8, length: 1 }
            ]);
        });

        it('captures a "//" comment up to (not including) the newline', (t: it.TestContext) => {
            t.assert.deepStrictEqual(tokenizePlainLyrics('// nota\n'), [
                { type: 'comment', value: '// nota', line: 1, column: 1, length: 7 },
                { type: 'verse-end', value: '\n', line: 1, column: 8, length: 1 }
            ]);
        });
    });

    it('collapses a run of 2+ newlines into a single "stanza-end", same as the annotated DSL', (t: it.TestContext) => {
        const types = tokenizePlainLyrics('sol\n\nluz\n').map(tok => tok.type);
        t.assert.deepStrictEqual(types, ['text', 'stanza-end', 'text', 'verse-end']);
    });
});
