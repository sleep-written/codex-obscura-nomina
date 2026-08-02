import { describe, it } from 'node:test';
import { classifyVowelChar, classifyVowelPair } from './spanish-vowels.js';

describe('classifyVowelChar', () => {
    it('classifies plain strong vowels', (t: it.TestContext) => {
        for (const ch of ['a', 'e', 'o', 'A', 'E', 'O']) {
            t.assert.deepStrictEqual(classifyVowelChar(ch), { strength: 'strong', accented: false });
        }
    });

    it('classifies plain weak vowels', (t: it.TestContext) => {
        for (const ch of ['i', 'u', 'I', 'U']) {
            t.assert.deepStrictEqual(classifyVowelChar(ch), { strength: 'weak', accented: false });
        }
    });

    it('classifies accented strong vowels', (t: it.TestContext) => {
        for (const ch of ['á', 'é', 'ó', 'Á']) {
            t.assert.strictEqual(classifyVowelChar(ch)?.strength, 'strong');
            t.assert.strictEqual(classifyVowelChar(ch)?.accented, true);
        }
    });

    it('classifies accented weak vowels', (t: it.TestContext) => {
        for (const ch of ['í', 'ú', 'Í']) {
            t.assert.strictEqual(classifyVowelChar(ch)?.strength, 'weak');
            t.assert.strictEqual(classifyVowelChar(ch)?.accented, true);
        }
    });

    it('classifies "ü" as an unaccented weak vowel', (t: it.TestContext) => {
        t.assert.deepStrictEqual(classifyVowelChar('ü'), { strength: 'weak', accented: false });
        t.assert.deepStrictEqual(classifyVowelChar('Ü'), { strength: 'weak', accented: false });
    });

    it('returns null for consonants', (t: it.TestContext) => {
        for (const ch of ['b', 'y', 'h', 'ñ', 'x']) {
            t.assert.strictEqual(classifyVowelChar(ch), null);
        }
    });
});

describe('classifyVowelPair', () => {
    const strong = (accented = false) => ({ strength: 'strong' as const, accented });
    const weak = (accented = false) => ({ strength: 'weak' as const, accented });

    it('is hiato when both vowels are strong', (t: it.TestContext) => {
        t.assert.strictEqual(classifyVowelPair(strong(), strong()), 'hiato');
    });

    it('is hiato when the weak vowel of the pair carries a written accent, in either order', (t: it.TestContext) => {
        t.assert.strictEqual(classifyVowelPair(weak(true), strong()), 'hiato');
        t.assert.strictEqual(classifyVowelPair(strong(), weak(true)), 'hiato');
        t.assert.strictEqual(classifyVowelPair(weak(true), weak()), 'hiato');
    });

    it('is diphthong for strong+weak or weak+strong with no accent on the weak vowel', (t: it.TestContext) => {
        t.assert.strictEqual(classifyVowelPair(strong(), weak()), 'diphthong');
        t.assert.strictEqual(classifyVowelPair(weak(), strong()), 'diphthong');
    });

    it('is diphthong for two unaccented weak vowels', (t: it.TestContext) => {
        t.assert.strictEqual(classifyVowelPair(weak(), weak()), 'diphthong');
    });

    it('a written accent on a strong vowel does NOT by itself force a hiato', (t: it.TestContext) => {
        t.assert.strictEqual(classifyVowelPair(strong(true), weak()), 'diphthong');
    });
});
