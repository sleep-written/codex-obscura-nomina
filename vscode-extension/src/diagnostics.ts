import * as vscode from 'vscode';
import { getParsed } from './document-store.js';

const LANGUAGE_ID = 'lyrics';

/**
 * `LyricsParseError` only carries a 1-indexed `line`/`column` point, not a
 * range — a single-character underline is enough for a `Diagnostic`, but a
 * whole word/comment token often overruns to end of line. Expands from the
 * error position to end of line; falls back to the whole line when that
 * would be empty (error reported at end of line/EOF). `line` is clamped
 * against `document.lineCount`: an "unexpected end of input" error can
 * report a line one past the document's last one.
 */
function errorRange(document: vscode.TextDocument, line: number, column: number): vscode.Range {
    const lineIndex = Math.min(line - 1, document.lineCount - 1);
    const lineText = document.lineAt(lineIndex).text;
    const startChar = Math.min(column - 1, lineText.length);

    return startChar < lineText.length
        ? new vscode.Range(lineIndex, startChar, lineIndex, lineText.length)
        : document.lineAt(lineIndex).range;
}

/**
 * Publishes `LyricsParseError` as an editor diagnostic (red squiggle +
 * Problems panel entry), reusing `getParsed`'s per-version cache so this
 * doesn't cost an extra parse beyond what hover/outline/completion already
 * trigger.
 */
export function registerDiagnostics(context: vscode.ExtensionContext): void {
    const collection = vscode.languages.createDiagnosticCollection('lyrics');
    context.subscriptions.push(collection);

    const refresh = (document: vscode.TextDocument): void => {
        if (document.languageId !== LANGUAGE_ID) {
            return;
        }

        const { error } = getParsed(document);
        if (error === null) {
            collection.delete(document.uri);
            return;
        }

        const diagnostic = new vscode.Diagnostic(
            errorRange(document, error.line, error.column),
            error.message,
            vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'lyrics';
        collection.set(document.uri, [diagnostic]);
    };

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(refresh),
        vscode.workspace.onDidChangeTextDocument(e => refresh(e.document)),
        vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri))
    );

    for (const document of vscode.workspace.textDocuments) {
        refresh(document);
    }
}
