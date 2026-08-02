/**
 * Pure text-based completion logic — no `vscode` import, so it can be unit
 * tested with `node --test` without mocking the extension host API.
 *
 * Deliberately NOT AST-based: while the user is typing, the document is
 * usually momentarily invalid for `parseLyrics` (e.g. a `#` alone before the
 * title text is finished), so relying on a parsed `SongNode` here would make
 * completion flicker or lag behind the cursor. Context is instead inferred
 * from the raw characters immediately around the cursor.
 */

const VOWELS = new Set('aeiouáéíóúüAEIOUÁÉÍÓÚÜ');

export function isVowel(ch: string | undefined): boolean {
    return ch !== undefined && VOWELS.has(ch);
}

export function isLetter(ch: string | undefined): boolean {
    return ch !== undefined && /\p{L}/u.test(ch);
}

export interface CompletionSuggestion {
    /** What to insert, as a snippet (may contain `${n:placeholder}`). */
    insertText: string;
    /** Shown in the completion list. */
    label: string;
    detail: string;
}

export interface CompletionContext {
    /** Text of the current line before the cursor. */
    before: string;
    /** Text of the current line after the cursor. */
    after: string;
    /** True if this is line 0 of the document — song titles are only valid there. */
    isFirstLine: boolean;
    /** True if the line immediately above is blank (a stanza just ended). */
    previousLineBlank: boolean;
}

/**
 * Never decides WHICH of a pair of opposite symbols (`+`/`_`, `%`/`/`) is
 * "correct" for a given vowel pair — there is no phonetic engine behind this
 * DSL (see the project's `lyrics-language-dsl` design notes), so both
 * options of an alterable pair are always offered together.
 */
export function getContextualSuggestions(ctx: CompletionContext): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];
    const trimmedBefore = ctx.before.trim();

    if (ctx.isFirstLine && trimmedBefore === '') {
        suggestions.push({ insertText: '# ${1:Título}', label: '#', detail: 'Título de la canción' });
    }
    if (trimmedBefore === '' && ctx.previousLineBlank) {
        suggestions.push({ insertText: '## ${1:Título}', label: '##', detail: 'Título de estrofa' });
    }

    const prev = ctx.before.at(-1);
    const next = ctx.after.at(0);

    if (isVowel(prev) && isVowel(next)) {
        suggestions.push(
            { insertText: '+', label: '+', detail: 'Diéresis activada — separa el par vocálico en dos sílabas' },
            { insertText: '_', label: '_', detail: 'Diéresis desactivada — el par vocálico queda en una sílaba' },
            { insertText: '%', label: '%', detail: 'Sinéresis activada — el par vocálico queda en una sílaba' },
            { insertText: '/', label: '/', detail: 'Sinéresis desactivada — separa el par vocálico en dos sílabas' }
        );
    }
    if (isLetter(prev) && isLetter(next)) {
        suggestions.push(
            { insertText: '&', label: '&', detail: 'Sinalefa activada — funde con la palabra siguiente' },
            { insertText: '|', label: '|', detail: 'Sinalefa desactivada — se podría fundir, pero no se funde' }
        );
    }
    if (!ctx.before.includes('//') && !ctx.after.includes('//')) {
        suggestions.push({ insertText: '// ${0:nota}', label: '//', detail: 'Comentario' });
    }

    return suggestions;
}
