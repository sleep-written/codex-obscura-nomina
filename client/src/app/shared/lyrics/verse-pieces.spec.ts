import { parseLyrics, parsePlainLyrics } from '@codex-obscura-nomina/lyrics-language';
import { versePieces } from './verse-pieces';

function render(pieces: ReturnType<typeof versePieces>): string {
  return pieces
    .map(piece => {
      switch (piece.kind) {
        case 'text': return piece.text;
        case 'separator': return '-';
        case 'marker': return piece.symbol;
      }
    })
    .join('');
}

describe('versePieces', () => {
  it('reconstructs an annotated verse from parseLyrics', () => {
    const song = parseLyrics('# T\ntri-fu_er-za\n');
    const verse = song.stanzas[0].verses[0];
    expect(render(versePieces(verse))).toBe('tri-fu_er-za');
  });

  it('reconstructs an annotated verse from parsePlainLyrics (synthetic zero-length tokens)', () => {
    const song = parsePlainLyrics('trifuerza\n');
    const verse = song.stanzas[0].verses[0];
    expect(render(versePieces(verse))).toBe('tri-fu_er-za');
  });

  it('emits exactly one sinalefa marker between two words and none after the last', () => {
    const song = parsePlainLyrics('hola mundo\n');
    const verse = song.stanzas[0].verses[0];
    const pieces = versePieces(verse);
    const sinalefaMarkers = pieces.filter(
      piece => piece.kind === 'marker' && piece.marker.kind === 'sinalefa',
    );
    expect(sinalefaMarkers.length).toBe(1);
    expect(pieces[pieces.length - 1].kind).not.toBe('marker');
  });
});
