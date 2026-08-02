import * as vscode from 'vscode';
import { locate, type AlterableMarker } from '@codex-obscura-nomina/lyrics-language';
import { getParsed } from '../document-store.js';
import { toLyricsPosition, toVscodeRange } from '../position.js';
import { describeMarkerState, toggleSymbol } from '../markers.js';

/**
 * Builds the hover content for an `AlterableMarker`: its current-state
 * description, plus a `command:` link that drives `lyrics.toggleMarker` —
 * this is the "click on an alteration to flip it" entry point. Only offers
 * the SAME kind's opposite symbol (`+`↔`_`, `%`↔`/`, `&`↔space) — diéresis
 * and sinéresis are different phenomena in the DSL, so this deliberately
 * never suggests crossing from one to the other. `isTrusted` is required
 * for VSCode to honor `command:` links from a hover. The command re-locates
 * the marker from `position` at click time (see `commands/toggle-marker.ts`)
 * rather than receiving it serialized here, so a stale hover can't act on
 * an outdated AST.
 */
function markerHover(marker: AlterableMarker, position: vscode.Position): vscode.MarkdownString {
    const args = encodeURIComponent(JSON.stringify([{ line: position.line, character: position.character }]));
    const md = new vscode.MarkdownString(describeMarkerState(marker.kind, marker.active));
    md.isTrusted = true;
    md.appendMarkdown(`\n\n[Cambiar a \`${toggleSymbol(marker)}\`](command:lyrics.toggleMarker?${args})`);
    return md;
}

export class LyricsHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const { song } = getParsed(document);
        if (song === null) {
            // No hover for a parse error — see diagnostics.ts, which surfaces it as a squiggle instead.
            return undefined;
        }

        const result = locate(song, toLyricsPosition(position));
        switch (result.kind) {
            case 'marker':
                return new vscode.Hover(markerHover(result.marker, position), toVscodeRange(result.marker.range));
            case 'comment':
                return new vscode.Hover(`Comentario (${result.owner})`, toVscodeRange(result.comment.range));
            case 'title':
                return new vscode.Hover(
                    result.owner === 'song' ? 'Título de la canción' : 'Título de la estrofa',
                    toVscodeRange(result.range)
                );
            case 'syllable':
                return new vscode.Hover(`Sílaba: \`${result.syllable.text}\``, toVscodeRange(result.syllable.range));
            default:
                return undefined;
        }
    }
}
