import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getContextualSuggestions } from './completion-context.js';

describe('getContextualSuggestions', () => {
    it('offers "#" at the start of an empty first line', () => {
        const suggestions = getContextualSuggestions({
            before: '', after: '', isFirstLine: true, previousLineBlank: false
        });
        assert.ok(suggestions.some(s => s.label === '#'));
        assert.ok(!suggestions.some(s => s.label === '##'));
    });

    it('offers "##" after a blank line, but not on the first line of the file', () => {
        const suggestions = getContextualSuggestions({
            before: '', after: '', isFirstLine: false, previousLineBlank: true
        });
        assert.ok(suggestions.some(s => s.label === '##'));
        assert.ok(!suggestions.some(s => s.label === '#'));
    });

    it('offers all four alterable-pair symbols between two vowels, never picking one', () => {
        const suggestions = getContextualSuggestions({
            before: 'fu', after: 'er', isFirstLine: false, previousLineBlank: false
        });
        const labels = suggestions.map(s => s.label).filter(l => '+_%/'.includes(l));
        assert.deepStrictEqual(new Set(labels), new Set(['+', '_', '%', '/']));
    });

    it('does not offer alterable-pair symbols between two consonants', () => {
        const suggestions = getContextualSuggestions({
            before: 'nie', after: 'go', isFirstLine: false, previousLineBlank: false
        });
        assert.ok(!suggestions.some(s => '+_%/'.includes(s.label)));
    });

    it('offers "&" between two letters', () => {
        const suggestions = getContextualSuggestions({
            before: 'a', after: 'otro', isFirstLine: false, previousLineBlank: false
        });
        assert.ok(suggestions.some(s => s.label === '&'));
    });

    it('does not offer "//" if the line already has a comment', () => {
        const suggestions = getContextualSuggestions({
            before: 'nie-go // ya', after: '', isFirstLine: false, previousLineBlank: false
        });
        assert.ok(!suggestions.some(s => s.label === '//'));
    });
});
