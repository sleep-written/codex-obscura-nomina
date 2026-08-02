import * as vscode from 'vscode';
import { locate, type AlterableMarker } from '@codex-obscura-nomina/lyrics-language';
import { getParsed } from '../document-store.js';
import { toLyricsPosition, toVscodeRange } from '../position.js';
import { toggleSymbol } from '../markers.js';

export interface MarkerAt {
    marker: AlterableMarker;
    range: vscode.Range;
}

/**
 * Resolves the `AlterableMarker` at `position`, if any. Re-parses through
 * the shared `document-store` cache rather than trusting a marker handed in
 * by a caller (e.g. a stale hover click) — always reflects the document as
 * it is right now.
 */
export function resolveMarkerAt(document: vscode.TextDocument, position: vscode.Position): MarkerAt | null {
    const { song } = getParsed(document);
    if (song === null) {
        return null;
    }
    const result = locate(song, toLyricsPosition(position));
    return result.kind === 'marker' ? { marker: result.marker, range: toVscodeRange(result.marker.range) } : null;
}

function resolvePosition(editor: vscode.TextEditor, arg: { line: number; character: number } | undefined): vscode.Position {
    return arg !== undefined ? new vscode.Position(arg.line, arg.character) : editor.selection.active;
}

/**
 * Registers `lyrics.toggleMarker` (`+`↔`_`, `%`↔`/`, `&`↔space) — the
 * "click on an alteration to flip it" command, driven from the hover's
 * `command:` link (`providers/hover.ts`) and from `providers/code-actions.ts`.
 * Accepts an optional `{ line, character }` argument (0-indexed, as sent by
 * the hover link); without it, acts on the active editor's cursor, so it
 * also works from the command palette or a keybinding.
 */
export function registerToggleMarkerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('lyrics.toggleMarker', async (arg?: { line: number; character: number }) => {
            const editor = vscode.window.activeTextEditor;
            if (editor === undefined) {
                return;
            }
            const found = resolveMarkerAt(editor.document, resolvePosition(editor, arg));
            if (found === null) {
                void vscode.window.showInformationMessage('No hay ninguna alteración bajo el cursor.');
                return;
            }
            await editor.edit(builder => builder.replace(found.range, toggleSymbol(found.marker)));
        })
    );
}
