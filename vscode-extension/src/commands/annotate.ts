import * as vscode from 'vscode';
import { parseLyrics, parsePlainLyrics, printLyrics, LyricsParseError } from '@codex-obscura-nomina/lyrics-language';

function targetRange(editor: vscode.TextEditor): vscode.Range {
    if (!editor.selection.isEmpty) {
        return editor.selection;
    }
    const text = editor.document.getText();
    return new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(text.length));
}

/**
 * `parsePlainLyrics` treats every DSL symbol as noise and recomputes each
 * vowel pair's natural state — running it over text that's already annotated
 * would silently discard any hand-placed `+`/`%`. This is an EXACT check
 * (does `source` parse as valid `.lyrics`?), not a heuristic over characters:
 * a stray `-` or dialogue dash in plain text won't trip it.
 */
function looksAlreadyAnnotated(source: string): boolean {
    try {
        parseLyrics(source);
        return true;
    } catch (err) {
        if (!(err instanceof LyricsParseError)) {
            throw err;
        }
        return false;
    }
}

/**
 * `lyrics.annotate`: takes the current selection (or the whole document when
 * nothing is selected), runs it through `parsePlainLyrics` (Spanish
 * syllabification) + `printLyrics`, and replaces the range with the
 * annotated `.lyrics` result.
 */
export function registerAnnotateCommand(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('lyrics.annotate', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined || editor.document.languageId !== 'lyrics') {
                return;
            }

            const range = targetRange(editor);
            const source = editor.document.getText(range);

            if (looksAlreadyAnnotated(source)) {
                const choice = await vscode.window.showWarningMessage(
                    'Este texto ya parece un .lyrics anotado. Volver a anotarlo descartará cualquier diéresis/sinéresis puesta a mano.',
                    { modal: true },
                    'Anotar de todos modos'
                );
                if (choice !== 'Anotar de todos modos') {
                    return;
                }
            }

            let annotated: string;
            try {
                annotated = printLyrics(parsePlainLyrics(source));
            } catch (err) {
                if (!(err instanceof LyricsParseError)) {
                    throw err;
                }
                void vscode.window.showErrorMessage(`No se pudo anotar: ${err.message}`);
                return;
            }

            // printLyrics always ends in '\n' — don't inject a trailing line
            // when annotating a selection that didn't have one.
            if (!source.endsWith('\n') && annotated.endsWith('\n')) {
                annotated = annotated.slice(0, -1);
            }

            await editor.edit(builder => builder.replace(range, annotated));
        })
    );
}
