import * as vscode from 'vscode';
import { locate, type AlterableMarker } from '@codex-obscura-nomina/lyrics-language';
import { getParsed } from '../document-store.js';
import { toLyricsPosition, toVscodeRange } from '../position.js';

const MARKER_DESCRIPTIONS: Record<`${AlterableMarker['kind']}:${'true' | 'false'}`, string> = {
    'diaeresis:true': 'Diéresis activada (`+`) — separa el par vocálico en dos sílabas.',
    'diaeresis:false': 'Diéresis desactivada (`_`) — el par vocálico queda en una sola sílaba.',
    'synaeresis:true': 'Sinéresis activada (`%`) — el par vocálico queda en una sola sílaba.',
    'synaeresis:false': 'Sinéresis desactivada (`/`) — separa el par vocálico en dos sílabas.',
    'sinalefa:true': 'Sinalefa activada (`&`) — funde esta palabra con la siguiente en una sola sílaba métrica.',
    'sinalefa:false': 'Sinalefa desactivada (espacio) — esta palabra no se funde con la siguiente.'
};

function describeMarker(marker: AlterableMarker): string {
    return MARKER_DESCRIPTIONS[`${marker.kind}:${marker.active}`];
}

export class LyricsHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const { song, error } = getParsed(document);
        if (song === null) {
            if (error !== null && error.line === position.line + 1 && error.column === position.character + 1) {
                return new vscode.Hover(`Parse error: ${error.message}`);
            }
            return undefined;
        }

        const result = locate(song, toLyricsPosition(position));
        switch (result.kind) {
            case 'marker':
                return new vscode.Hover(describeMarker(result.marker), toVscodeRange(result.marker.range));
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
