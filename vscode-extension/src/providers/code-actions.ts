import * as vscode from 'vscode';
import { resolveMarkerAt } from '../commands/toggle-marker.js';
import { toggleSymbol } from '../markers.js';

/**
 * Keyboard/lightbulb (`Ctrl+.`) entry point for the same toggle the hover's
 * `command:` link offers — see `commands/toggle-marker.ts` for the shared
 * marker-resolution logic.
 */
export class LyricsCodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [vscode.CodeActionKind.RefactorRewrite];

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
        const found = resolveMarkerAt(document, range.start);
        if (found === null) {
            return [];
        }

        const symbol = toggleSymbol(found.marker);
        const action = new vscode.CodeAction(`Cambiar a "${symbol}"`, vscode.CodeActionKind.RefactorRewrite);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, found.range, symbol);
        return [action];
    }
}
