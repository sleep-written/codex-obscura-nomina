import { parseLyrics, printLyrics } from '@codex-obscura-nomina/lyrics-language';
import { fromSongNode, normalizeDraft, toSongNode } from './song-node';
import type { SongVm } from '../song/song-vm';

const SOURCE = `# Torquemada
artist: Avalanch
album: Llanto De Un Héroe
albumArtist: Avalanch
albumYear: 1999
trackNumber: 2
## Verso
desiredLength: 11
La|i-gle-si_a|en sus ma-nos de-le-gó
`;

describe('song-node', () => {
  it('lee la metadata de la canción y el desiredLength de la estrofa hacia el VM', () => {
    const vm = fromSongNode(parseLyrics(SOURCE));

    expect(vm.title).toBe('Torquemada');
    expect(vm.metadata).toEqual({
      artist: 'Avalanch',
      album: 'Llanto De Un Héroe',
      albumArtist: 'Avalanch',
      albumYear: 1999,
      trackNumber: 2,
    });
    expect(vm.stanzas[0].target).toBe(11);
  });

  it('devuelve la metadata al .lyrics sin perder ningún campo', () => {
    const printed = printLyrics(toSongNode(fromSongNode(parseLyrics(SOURCE))));

    expect(printed).toBe(SOURCE);
  });

  it('omite los campos vacíos en vez de emitir una línea sin valor', () => {
    const vm = fromSongNode(parseLyrics('# Torquemada\nartist: Avalanch\nla-la\n'));
    const printed = printLyrics(toSongNode(vm));

    expect(printed).toBe('# Torquemada\nartist: Avalanch\nla-la\n');
  });

  it('rellena la metadata que falta en un borrador de una versión anterior', () => {
    // Lo que había en localStorage antes de que existiera la metadata: sin
    // `metadata` en la canción ni en el nodo de la estrofa.
    const stored = {
      title: 'Torquemada',
      stanzas: [
        {
          id: 'x',
          titleText: 'Verso',
          rawText: 'lala',
          error: null,
          target: null,
          node: { title: null, comments: [], verses: [], range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } },
        },
      ],
    } as unknown as Partial<SongVm>;

    const vm = normalizeDraft(stored);

    expect(vm.metadata.artist).toBe('');
    expect(vm.metadata.albumYear).toBeNull();
    expect(vm.stanzas[0].node.metadata).toEqual({ desiredLength: null });
    expect(() => printLyrics(toSongNode(vm))).not.toThrow();
  });
});
