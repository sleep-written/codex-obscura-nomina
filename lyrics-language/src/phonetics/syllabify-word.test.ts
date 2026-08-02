import { describe, it } from 'node:test';
import { syllabifyWord } from './syllabify-word.js';
import type { MarkerEvent } from './syllabify-word.js';

describe('syllabifyWord', () => {
    it('marks a natural diphthong with "diaeresis-off", not a boundary ("tiempo" -> tiem-po)', (t: it.TestContext) => {
        t.assert.deepStrictEqual(syllabifyWord('tiempo'), [
            { offset: 2, kind: 'diaeresis-off' },
            { offset: 4, kind: 'syllable-separator' }
        ] satisfies MarkerEvent[]);
    });

    it('marks a natural hiato of two strong vowels as a boundary ("poeta" -> po-e-ta)', (t: it.TestContext) => {
        t.assert.deepStrictEqual(syllabifyWord('poeta'), [
            { offset: 2, kind: 'synaeresis-off' },
            { offset: 3, kind: 'syllable-separator' }
        ] satisfies MarkerEvent[]);
    });

    describe('hiato acentual (accented weak vowel)', () => {
        it('"envío" -> en-ví-o', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('envío'), [
                { offset: 2, kind: 'syllable-separator' },
                { offset: 4, kind: 'synaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"país" -> pa-ís', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('país'), [
                { offset: 2, kind: 'synaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"raíz" -> ra-íz', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('raíz'), [
                { offset: 2, kind: 'synaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"increíble" -> in-cre-í-ble (hiato + two inseparable consonant groups)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('increíble'), [
                { offset: 2, kind: 'syllable-separator' },
                { offset: 5, kind: 'synaeresis-off' },
                { offset: 6, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });
    });

    describe('silent "u" after g/q vs. orthographic "ü"', () => {
        it('"queso" -> que-so (silent u, not a vowel)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('queso'), [
                { offset: 3, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('"guerra" -> gue-rra (silent u + "rr" digraph)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('guerra'), [
                { offset: 3, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('"cigüeña" -> ci-güe-ña ("ü" counts as a vowel, forms a diphthong with "e")', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('cigüeña'), [
                { offset: 2, kind: 'syllable-separator' },
                { offset: 4, kind: 'diaeresis-off' },
                { offset: 5, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });
    });

    it('treats an intermediate "h" as transparent to vowel adjacency ("ahora" -> a-ho-ra, hiato across the "h")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(syllabifyWord('ahora'), [
            { offset: 1, kind: 'synaeresis-off' },
            { offset: 3, kind: 'syllable-separator' }
        ] satisfies MarkerEvent[]);
    });

    describe('"y" as a word-final weak vowel vs. an intervocalic consonant', () => {
        it('"hoy" is monosyllabic (y as weak vowel, diphthong with "o")', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('hoy'), [
                { offset: 2, kind: 'diaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"voy" is monosyllabic', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('voy'), [
                { offset: 2, kind: 'diaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"rey" is monosyllabic', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('rey'), [
                { offset: 2, kind: 'diaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"muy" is monosyllabic (two weak vowels, "u" then "y")', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('muy'), [
                { offset: 2, kind: 'diaeresis-off' }
            ] satisfies MarkerEvent[]);
        });

        it('"reyes" -> re-yes ("y" mid-word stays a consonant)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('reyes'), [
                { offset: 2, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });
    });

    describe('digraphs never split ("ch", "ll", "rr")', () => {
        it('"coche" -> co-che', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('coche'), [
                { offset: 2, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('"calle" -> ca-lle', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('calle'), [
                { offset: 2, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('"carro" -> ca-rro', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('carro'), [
                { offset: 2, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });
    });

    describe('consonant cluster splitting', () => {
        it('an inseparable group of 2 goes entirely with the next vowel ("abrir" -> a-brir)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('abrir'), [
                { offset: 1, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('a separable group of 2 splits one-one ("cantar" -> can-tar)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('cantar'), [
                { offset: 3, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('a 3-consonant group with an inseparable tail ("siempre" -> siem-pre)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('siempre'), [
                { offset: 2, kind: 'diaeresis-off' },
                { offset: 4, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });

        it('nested 3-4 consonant groups ("instrumento" -> ins-tru-men-to)', (t: it.TestContext) => {
            t.assert.deepStrictEqual(syllabifyWord('instrumento'), [
                { offset: 3, kind: 'syllable-separator' },
                { offset: 6, kind: 'syllable-separator' },
                { offset: 9, kind: 'syllable-separator' }
            ] satisfies MarkerEvent[]);
        });
    });

    it('returns no events for a word with a single vowel run and no internal boundary ("tres")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(syllabifyWord('tres'), []);
    });

    it('returns no events (not a throw) for a word with no vowels', (t: it.TestContext) => {
        t.assert.deepStrictEqual(syllabifyWord('brr'), []);
    });

    it('documented limitation: a true triphthong keeps both diphthong events, even though the AST layer can only retain the last one ("buey")', (t: it.TestContext) => {
        t.assert.deepStrictEqual(syllabifyWord('buey'), [
            { offset: 2, kind: 'diaeresis-off' },
            { offset: 3, kind: 'diaeresis-off' }
        ] satisfies MarkerEvent[]);
    });
});
