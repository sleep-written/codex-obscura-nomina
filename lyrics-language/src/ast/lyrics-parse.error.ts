/**
 * Thrown when a token sequence doesn't match the `.lyrics` grammar
 * structurally (e.g. a stray symbol, a title marker with no text, a word
 * that starts with a syllable separator). Never thrown for phonetic reasons
 * — the parser trusts alterable markers as-is, it doesn't evaluate them.
 */
export class LyricsParseError extends Error {
    readonly line: number;
    readonly column: number;

    constructor(message: string, line: number, column: number) {
        super(`${message} (line ${line}, column ${column})`);
        this.name = 'LyricsParseError';
        this.line = line;
        this.column = column;
    }
}
