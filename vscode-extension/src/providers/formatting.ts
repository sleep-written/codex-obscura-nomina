import * as vscode from 'vscode';
import { printLyrics } from '@codex-obscura-nomina/lyrics-language';
import { getParsed } from '../document-store.js';

function fullRange(document: vscode.TextDocument): vscode.Range {
    return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
}

/**
 * Canonicalizes a `.lyrics` document via `printLyrics` (see
 * `memory/lyrics-printer.md`): `###`+ stanza markers collapse to `##`,
 * comments become exactly `// text`, and runs of blank lines between
 * stanzas collapse to exactly one.
 */
export class LyricsDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const { song } = getParsed(document);
        if (song === null) {
            // Invalid input can't be formatted — diagnostics.ts already explains why.
            return [];
        }

        const formatted = printLyrics(song);
        if (formatted === document.getText()) {
            return [];
        }
        return [vscode.TextEdit.replace(fullRange(document), formatted)];
    }
}
