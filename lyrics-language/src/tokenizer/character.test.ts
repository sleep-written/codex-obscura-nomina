import { describe, it } from 'node:test';
import { Character } from './character.js';

describe('Character', () => {
    it('Split "joder\\nchaval🫠💀💩"', (t: it.TestContext) => {
        const items = Character
            .split('joder\nchaval🫠💀💩')
            .map(x => ({
                col: x.col,
                row: x.row,
                v:   x.toString()
            }));

        t.assert.deepStrictEqual(items, [
            { col: 1, row: 1,  v: 'j' },
            { col: 2, row: 1,  v: 'o' },
            { col: 3, row: 1,  v: 'd' },
            { col: 4, row: 1,  v: 'e' },
            { col: 5, row: 1,  v: 'r' },
            { col: 6, row: 1,  v: '\n' },
            { col: 1, row: 2,  v: 'c' },
            { col: 2, row: 2,  v: 'h' },
            { col: 3, row: 2,  v: 'a' },
            { col: 4, row: 2,  v: 'v' },
            { col: 5, row: 2,  v: 'a' },
            { col: 6, row: 2,  v: 'l' },
            { col: 7, row: 2,  v: '🫠' },
            { col: 8, row: 2,  v: '💀' },
            { col: 9, row: 2,  v: '💩' }
        ]);
    });
});
