import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { toggleSymbol, symbolFor, describeMarkerState } from './markers.js';

const range = { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } };

describe('toggleSymbol', () => {
    it('flips diéresis on/off', () => {
        assert.strictEqual(toggleSymbol({ kind: 'diaeresis', active: true, range }), '_');
        assert.strictEqual(toggleSymbol({ kind: 'diaeresis', active: false, range }), '+');
    });

    it('flips sinéresis on/off', () => {
        assert.strictEqual(toggleSymbol({ kind: 'synaeresis', active: true, range }), '/');
        assert.strictEqual(toggleSymbol({ kind: 'synaeresis', active: false, range }), '%');
    });

    it('flips sinalefa on/off', () => {
        assert.strictEqual(toggleSymbol({ kind: 'sinalefa', active: true, range }), '|');
        assert.strictEqual(toggleSymbol({ kind: 'sinalefa', active: false, range }), '&');
    });
});

describe('symbolFor / describeMarkerState', () => {
    it('covers every kind:active combination', () => {
        for (const kind of ['diaeresis', 'synaeresis', 'sinalefa'] as const) {
            for (const active of [true, false]) {
                assert.strictEqual(typeof symbolFor(kind, active), 'string');
                assert.strictEqual(typeof describeMarkerState(kind, active), 'string');
            }
        }
    });
});
