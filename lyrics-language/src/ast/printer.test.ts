import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseLyrics, printLyrics } from './index.js';

/** Recursively drops every `range` key so two ASTs can be compared position-agnostically. */
function stripRanges<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(stripRanges) as T;
    }
    if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            if (key !== 'range') {
                out[key] = stripRanges(val);
            }
        }
        return out as T;
    }
    return value;
}

/** Parses `source`, prints it, re-parses the result, and asserts the two ASTs match ignoring `range`. */
function assertRoundTrips(t: it.TestContext, source: string): void {
    const original = parseLyrics(source);
    const printed = printLyrics(original);
    const reparsed = parseLyrics(printed);
    t.assert.deepStrictEqual(stripRanges(reparsed), stripRanges(original));
}

/** Asserts `printLyrics(parseLyrics(source)) === source` and that the round trip is structurally sound too. */
function assertPrintsExactly(t: it.TestContext, source: string): void {
    t.assert.strictEqual(printLyrics(parseLyrics(source)), source);
    assertRoundTrips(t, source);
}

describe('printLyrics', () => {
    it('prints a plain syllable separator', (t: it.TestContext) => {
        assertPrintsExactly(t, 'nie-go\n');
    });

    it('prints diéresis activada (boundary)', (t: it.TestContext) => {
        assertPrintsExactly(t, 'fu+er\n');
    });

    it('prints diéresis desactivada (internal marker)', (t: it.TestContext) => {
        assertPrintsExactly(t, 'tri-fu_er-za\n');
    });

    it('prints sinéresis desactivada (boundary)', (t: it.TestContext) => {
        assertPrintsExactly(t, 'a/ho-ra\n');
    });

    it('prints sinéresis activada (internal marker)', (t: it.TestContext) => {
        assertPrintsExactly(t, 'pa-ra%u\n');
    });

    it('prints sinalefa activada', (t: it.TestContext) => {
        assertPrintsExactly(t, 'a&otro\n');
    });

    it('prints sinalefa desactivada as a plain word separator', (t: it.TestContext) => {
        assertPrintsExactly(t, 'a otro\n');
    });

    it('prints a song title', (t: it.TestContext) => {
        assertPrintsExactly(t, '# Song\nnie-go\n');
    });

    it('prints a stanza title', (t: it.TestContext) => {
        assertPrintsExactly(t, '## Stanza\nnie-go\n');
    });

    it('canonicalizes 3+ "#" stanza titles down to exactly "##"', (t: it.TestContext) => {
        const song = parseLyrics('###Stanza\nnie-go\n');
        t.assert.strictEqual(printLyrics(song), '## Stanza\nnie-go\n');
    });

    it('emits no "##" line for an untitled stanza', (t: it.TestContext) => {
        assertPrintsExactly(t, 'nie-go\nla-la\n');
    });

    it('emits no "#" line for a titleless song', (t: it.TestContext) => {
        const song = parseLyrics('nie-go\n');
        t.assert.strictEqual(song.title, null);
        t.assert.ok(!printLyrics(song).startsWith('#'));
    });

    it('separates stanzas by exactly one blank line', (t: it.TestContext) => {
        assertPrintsExactly(t, 'nie-go\n\n## Stanza\nla-la\n');
    });

    it('prints a leading comment on its own line before the node it leads', (t: it.TestContext) => {
        assertPrintsExactly(t, '// nota\n## Estrofa\nnie-go\n');
    });

    it('prints a trailing comment appended to its content line', (t: it.TestContext) => {
        assertPrintsExactly(t, 'nie-go // nota\n');
    });

    it('prints a dangling end-of-file comment on its own line after the node', (t: it.TestContext) => {
        assertPrintsExactly(t, 'nie-go\n// nota final\n');
    });

    it('prints multiple stacked leading comments in order', (t: it.TestContext) => {
        assertPrintsExactly(t, '// uno\n// dos\n## Estrofa\nnie-go\n');
    });

    it('round-trips an empty song to an empty string', (t: it.TestContext) => {
        const song = parseLyrics('');
        t.assert.strictEqual(printLyrics(song), '');
    });

    it('round-trips the delirio-en-hyrule fixture byte-for-byte', async (t: it.TestContext) => {
        const fixturePath = fileURLToPath(new URL('../../fixtures/delirio-en-hyrule.lyrics', import.meta.url));
        const source = await readFile(fixturePath, 'utf-8');

        t.assert.strictEqual(printLyrics(parseLyrics(source)), source);
        assertRoundTrips(t, source);
    });
});
