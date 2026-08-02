import type { Range, SongNode, StanzaNode, TitledText } from '@codex-obscura-nomina/lyrics-language';
import { printPlainLyrics } from '@codex-obscura-nomina/lyrics-language';
import type { SongVm, StanzaVm } from '../song/song-vm';

/**
 * Rango sintético para nodos que el cliente crea de cero. La línea es
 * deliberadamente enorme: `classifyComments` del printer bucketea los
 * comentarios comparando su línea contra la del título, y con una línea
 * altísima todos caen en "leading" (se imprimen antes del título), que es
 * la ubicación natural.
 */
const SYNTHETIC_RANGE: Range = {
  start: { line: Number.MAX_SAFE_INTEGER, column: 1 },
  end: { line: Number.MAX_SAFE_INTEGER, column: 1 },
};

function stanzaTitle(vm: StanzaVm): TitledText | null {
  const text = vm.titleText.trim();
  if (text.length === 0) return null;
  return { text, range: vm.node.title?.range ?? SYNTHETIC_RANGE };
}

export function toSongNode(vm: SongVm): SongNode {
  const title = vm.title.trim();
  return {
    title: title.length === 0 ? null : { text: title, range: SYNTHETIC_RANGE },
    comments: [],
    stanzas: vm.stanzas.map((stanza): StanzaNode => ({
      title: stanzaTitle(stanza),
      comments: stanza.node.comments,
      verses: stanza.node.verses,
      range: stanza.node.range,
    })),
    range: SYNTHETIC_RANGE,
  };
}

export function fromSongNode(song: SongNode): SongVm {
  return {
    title: song.title?.text ?? '',
    stanzas: song.stanzas.map((stanza): StanzaVm => ({
      id: crypto.randomUUID(),
      titleText: stanza.title?.text ?? '',
      rawText: printPlainLyrics({
        title: null,
        comments: [],
        stanzas: [{ ...stanza, title: null, comments: [] }],
        range: SYNTHETIC_RANGE,
      }).trimEnd(),
      node: stanza,
      error: null,
      target: null,
    })),
  };
}
