import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mergeTokenColorRules, LYRICS_TOKEN_COLOR_RULES } from './token-colors.js';

describe('mergeTokenColorRules', () => {
    it('appends all of ours when the user has no existing rules', () => {
        const result = mergeTokenColorRules([], LYRICS_TOKEN_COLOR_RULES);
        assert.deepStrictEqual(result, LYRICS_TOKEN_COLOR_RULES);
    });

    it('returns null when every one of our scopes is already covered', () => {
        const existing = LYRICS_TOKEN_COLOR_RULES.map(rule => ({ scope: rule.scope, settings: { foreground: '#000000' } }));
        const result = mergeTokenColorRules(existing, LYRICS_TOKEN_COLOR_RULES);
        assert.strictEqual(result, null);
    });

    it('preserves the user\'s own unrelated rules and their custom color for an already-covered scope', () => {
        const existing = [
            { scope: 'comment.line.lyrics', settings: { foreground: '#ff00ff' } },
            { scope: 'punctuation.separator.syllable.lyrics', settings: { foreground: '#111111' } }
        ];
        const result = mergeTokenColorRules(existing, LYRICS_TOKEN_COLOR_RULES);

        assert.ok(result !== null);
        // The user's own rules survive untouched, including their override
        // of a scope we also define a default for.
        assert.deepStrictEqual(result!.slice(0, 2), existing);
        // Every one of our scopes not already present got appended.
        const resultScopes = new Set(result!.map(r => r.scope));
        for (const rule of LYRICS_TOKEN_COLOR_RULES) {
            if (rule.scope !== 'punctuation.separator.syllable.lyrics') {
                assert.ok(resultScopes.has(rule.scope));
            }
        }
        assert.strictEqual(result!.filter(r => r.scope === 'punctuation.separator.syllable.lyrics').length, 1);
    });
});
