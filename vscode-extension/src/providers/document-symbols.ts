import * as vscode from 'vscode';
import type { VerseNode } from '@codex-obscura-nomina/lyrics-language';
import { getParsed } from '../document-store.js';
import { toVscodeRange } from '../position.js';

function verseText(verse: VerseNode): string {
    return verse.words
        .map(word => word.syllables.map(syllable => syllable.text).join(''))
        .join(' ');
}

export class LyricsDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
        const { song } = getParsed(document);
        if (song === null) {
            return [];
        }

        const songRange = toVscodeRange(song.range);
        const root = new vscode.DocumentSymbol(
            song.title?.text ?? '(canción sin título)',
            `${song.stanzas.length} estrofa(s)`,
            vscode.SymbolKind.File,
            songRange,
            song.title !== null ? toVscodeRange(song.title.range) : songRange
        );

        root.children = song.stanzas.map((stanza, stanzaIndex) => {
            const stanzaRange = toVscodeRange(stanza.range);
            const stanzaSymbol = new vscode.DocumentSymbol(
                stanza.title?.text ?? `Estrofa ${stanzaIndex + 1}`,
                `${stanza.verses.length} verso(s)`,
                vscode.SymbolKind.Class,
                stanzaRange,
                stanza.title !== null ? toVscodeRange(stanza.title.range) : stanzaRange
            );

            stanzaSymbol.children = stanza.verses.map((verse, verseIndex) => {
                const verseRange = toVscodeRange(verse.range);
                return new vscode.DocumentSymbol(
                    verseText(verse) || `Verso ${verseIndex + 1}`,
                    '',
                    vscode.SymbolKind.String,
                    verseRange,
                    verseRange
                );
            });

            return stanzaSymbol;
        });

        return [root];
    }
}
