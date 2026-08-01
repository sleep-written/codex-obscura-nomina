import { describe, it } from 'node:test';
import { Tokenizer } from './tokenizer.js';

describe('Tokenizer', () => {
    it('odd/even', (t: it.TestContext) => {
        const tokenizer = new Tokenizer({
            odd: {
                close: next => (
                    (typeof next !== 'string') ||
                    (parseInt(next) % 2 !== 0)
                ),
                hold: acum => !acum
                    .split('')
                    .map(x => parseInt(x))
                    .some(x => x % 2 !== 0)
            },
            even: {
                close: next => (
                    (typeof next !== 'string') ||
                    (parseInt(next) % 2 === 0)
                ),
                hold: acum => !acum
                    .split('')
                    .map(x => parseInt(x))
                    .some(x => x % 2 === 0)
            }
        });

        const tokens = tokenizer.tokenize('135246');
        t.assert.deepStrictEqual(tokens, [
            {
                type: 'odd',
                value: '135',

                line: 1,
                column: 1,
                length: 3
            },
            {
                type: 'even',
                value: '246',

                line: 1,
                column: 4,
                length: 3
            }
        ]);
    });

    it('a lone odd digit does not swallow the following even run ("342")', (t: it.TestContext) => {
        const tokenizer = new Tokenizer({
            odd: {
                close: next => (
                    (typeof next !== 'string') ||
                    (parseInt(next) % 2 !== 0)
                ),
                hold: acum => !acum
                    .split('')
                    .map(x => parseInt(x))
                    .some(x => x % 2 !== 0)
            },
            even: {
                close: next => (
                    (typeof next !== 'string') ||
                    (parseInt(next) % 2 === 0)
                ),
                hold: acum => !acum
                    .split('')
                    .map(x => parseInt(x))
                    .some(x => x % 2 === 0)
            }
        });

        const tokens = tokenizer.tokenize('342');
        t.assert.deepStrictEqual(tokens, [
            {
                type: 'odd',
                value: '3',

                line: 1,
                column: 1,
                length: 1
            },
            {
                type: 'even',
                value: '42',

                line: 1,
                column: 2,
                length: 2
            }
        ]);
    });

    it('words and spaces ("foo bar")', (t: it.TestContext) => {
        const isLetter = (v?: string) => typeof v === 'string' && /[a-z]/i.test(v);
        const isSpace = (v?: string) => v === ' ';

        const tokenizer = new Tokenizer({
            word: { close: (next?: string) => isLetter(next) },
            space: { close: (next?: string) => isSpace(next) }
        });

        const tokens = tokenizer.tokenize('foo bar');
        t.assert.deepStrictEqual(tokens, [
            { type: 'word',  value: 'foo', line: 1, column: 1, length: 3 },
            { type: 'space', value: ' ',   line: 1, column: 4, length: 1 },
            { type: 'word',  value: 'bar', line: 1, column: 5, length: 3 }
        ]);
    });

    it('letters and digits ("abc123def")', (t: it.TestContext) => {
        const tokenizer = new Tokenizer({
            letter: { close: (next?: string) => typeof next === 'string' && /[a-z]/i.test(next) },
            digit: { close: (next?: string) => typeof next === 'string' && /[0-9]/.test(next) }
        });

        const tokens = tokenizer.tokenize('abc123def');
        t.assert.deepStrictEqual(tokens, [
            { type: 'letter', value: 'abc', line: 1, column: 1, length: 3 },
            { type: 'digit',  value: '123', line: 1, column: 4, length: 3 },
            { type: 'letter', value: 'def', line: 1, column: 7, length: 3 }
        ]);
    });

    it('tracks line/column across newlines ("ab\\ncd")', (t: it.TestContext) => {
        const tokenizer = new Tokenizer({
            text: { close: (next?: string) => typeof next === 'string' && next !== '\n' },
            newline: { close: (next?: string) => next === '\n' }
        });

        const tokens = tokenizer.tokenize('ab\ncd');
        t.assert.deepStrictEqual(tokens, [
            { type: 'text',    value: 'ab',  line: 1, column: 1, length: 2 },
            { type: 'newline', value: '\n',  line: 1, column: 3, length: 1 },
            { type: 'text',    value: 'cd',  line: 2, column: 1, length: 2 }
        ]);
    });

    it('accepts a factory constructor, splitting every character into its own token', (t: it.TestContext) => {
        class SingleCharFactory {
            close(): boolean {
                return false;
            }
        }

        const tokenizer = new Tokenizer({ char: SingleCharFactory });

        const tokens = tokenizer.tokenize('abc');
        t.assert.deepStrictEqual(tokens, [
            { type: 'char', value: 'a', line: 1, column: 1, length: 1 },
            { type: 'char', value: 'b', line: 1, column: 2, length: 1 },
            { type: 'char', value: 'c', line: 1, column: 3, length: 1 }
        ]);
    });

    it('returns no tokens for an empty string', (t: it.TestContext) => {
        const tokenizer = new Tokenizer({
            odd: {
                close: next => (
                    (typeof next !== 'string') ||
                    (parseInt(next) % 2 !== 0)
                )
            },
            even: {
                close: next => (
                    (typeof next !== 'string') ||
                    (parseInt(next) % 2 === 0)
                )
            }
        });

        const tokens = tokenizer.tokenize('');
        t.assert.deepStrictEqual(tokens, []);
    });
});
