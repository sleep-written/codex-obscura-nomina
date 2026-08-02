import * as vscode from 'vscode';
import type { Position, Range } from '@codex-obscura-nomina/lyrics-language';

/** lyrics-language positions are 1-indexed; vscode.Position is 0-indexed. */
export function toLyricsPosition(pos: vscode.Position): Position {
    return { line: pos.line + 1, column: pos.character + 1 };
}

export function toVscodeRange(range: Range): vscode.Range {
    return new vscode.Range(
        range.start.line - 1, range.start.column - 1,
        range.end.line - 1, range.end.column - 1
    );
}
