import type { AlterableMarker, VerseNode } from '@codex-obscura-nomina/lyrics-language';
import { markerSymbol } from './marker-symbol';

export type VersePiece =
  | { kind: 'text'; text: string }
  | { kind: 'separator' }
  | { kind: 'marker'; marker: AlterableMarker; symbol: string };

export function versePieces(verse: VerseNode): VersePiece[] {
  const pieces: VersePiece[] = [];

  for (const word of verse.words) {
    for (const syllable of word.syllables) {
      if (syllable.internalMarker !== null) {
        const marker = syllable.internalMarker;
        const offset = marker.range.start.column - syllable.range.start.column;
        const head = syllable.text.slice(0, offset);
        const tail = syllable.text.slice(offset);
        if (head.length > 0) pieces.push({ kind: 'text', text: head });
        pieces.push({ kind: 'marker', marker, symbol: markerSymbol(marker) });
        if (tail.length > 0) pieces.push({ kind: 'text', text: tail });
      } else if (syllable.text.length > 0) {
        pieces.push({ kind: 'text', text: syllable.text });
      }

      if (syllable.boundary === 'separator') {
        pieces.push({ kind: 'separator' });
      } else if (syllable.boundary !== null) {
        const marker = syllable.boundary;
        pieces.push({ kind: 'marker', marker, symbol: markerSymbol(marker) });
      }
    }

    if (word.trailingJoin !== null) {
      const marker = word.trailingJoin;
      pieces.push({ kind: 'marker', marker, symbol: markerSymbol(marker) });
    }
  }

  return pieces;
}
