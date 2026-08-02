/**
 * 1-based line/column position within a `.lyrics` source string — same
 * convention as `Token.line`/`Token.column` (see tokenizer/interfaces/token.ts).
 * Consumers that build a `vscode.Position` must subtract 1 from both fields
 * (VSCode positions are 0-indexed).
 */
export interface Position {
    line: number;
    column: number;
}

/**
 * A span within a `.lyrics` source string. `start` is inclusive, `end` is
 * exclusive (one column past the last grapheme) — same convention as
 * `token.column + token.length` for a single-line token.
 */
export interface Range {
    start: Position;
    end: Position;
}
