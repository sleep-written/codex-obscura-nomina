import * as vscode from 'vscode';
import { invalidate } from './document-store.js';
import { ensureTokenColors } from './activation.js';
import { LyricsHoverProvider } from './providers/hover.js';
import { LyricsDocumentSymbolProvider } from './providers/document-symbols.js';
import { LyricsCompletionItemProvider } from './providers/completion.js';

const LANGUAGE_SELECTOR: vscode.DocumentSelector = { language: 'lyrics' };

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(LANGUAGE_SELECTOR, new LyricsHoverProvider()),
        vscode.languages.registerDocumentSymbolProvider(LANGUAGE_SELECTOR, new LyricsDocumentSymbolProvider()),
        vscode.languages.registerCompletionItemProvider(
            LANGUAGE_SELECTOR,
            new LyricsCompletionItemProvider(),
            '+', '_', '%', '/', '&', '#'
        ),
        vscode.workspace.onDidCloseTextDocument(doc => invalidate(doc.uri))
    );

    void ensureTokenColors().catch(err => console.error('lyrics-language-vscode: failed to set default token colors', err));
}

export function deactivate(): void {
    // No cleanup needed: providers/subscriptions are disposed by VSCode via
    // context.subscriptions, and the parse cache is per-process, not
    // per-activation.
}
