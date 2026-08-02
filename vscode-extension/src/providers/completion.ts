import * as vscode from 'vscode';
import { getContextualSuggestions } from './completion-context.js';

export class LyricsCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const line = document.lineAt(position.line).text;
        const previousLineBlank = position.line > 0
            ? document.lineAt(position.line - 1).text.trim() === ''
            : false;

        const suggestions = getContextualSuggestions({
            before: line.slice(0, position.character),
            after: line.slice(position.character),
            isFirstLine: position.line === 0,
            previousLineBlank
        });

        return suggestions.map(s => {
            const item = new vscode.CompletionItem(s.label, vscode.CompletionItemKind.Operator);
            item.insertText = new vscode.SnippetString(s.insertText);
            item.detail = s.detail;
            return item;
        });
    }
}
