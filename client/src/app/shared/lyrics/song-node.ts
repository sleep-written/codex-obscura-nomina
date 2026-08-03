import type {
  MetadataEntry,
  Range,
  SongMetadata,
  SongNode,
  StanzaNode,
  TitledText,
} from '@codex-obscura-nomina/lyrics-language';
import {
  emptySongMetadata,
  emptyStanzaMetadata,
  printPlainLyrics,
} from '@codex-obscura-nomina/lyrics-language';
import type { SongMetadataVm, SongVm, StanzaVm } from '../song/song-vm';
import { emptySongMetadataVm } from '../song/song-vm';

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

/**
 * Construye una entrada de metadata desde el valor de un input. Todas comparten
 * `SYNTHETIC_RANGE`: el printer desempata por el orden canónico de claves del
 * paquete cuando los rangos empatan, así que el bloque sale siempre igual.
 */
function entry<V extends string | number>(
  key: MetadataEntry['key'],
  value: V | null,
): MetadataEntry<V> | null {
  if (value === null || value === '') return null;
  return {
    key,
    value,
    keyRange: SYNTHETIC_RANGE,
    valueRange: SYNTHETIC_RANGE,
    range: SYNTHETIC_RANGE,
  };
}

function toSongMetadata(vm: SongMetadataVm): SongMetadata {
  return {
    artist: entry('artist', vm.artist.trim()),
    album: entry('album', vm.album.trim()),
    albumArtist: entry('albumArtist', vm.albumArtist.trim()),
    albumYear: entry('albumYear', vm.albumYear),
    trackNumber: entry('trackNumber', vm.trackNumber),
  };
}

function fromSongMetadata(metadata: SongMetadata): SongMetadataVm {
  return {
    artist: metadata.artist?.value ?? '',
    album: metadata.album?.value ?? '',
    albumArtist: metadata.albumArtist?.value ?? '',
    albumYear: metadata.albumYear?.value ?? null,
    trackNumber: metadata.trackNumber?.value ?? null,
  };
}

export function toSongNode(vm: SongVm): SongNode {
  const title = vm.title.trim();
  return {
    title: title.length === 0 ? null : { text: title, range: SYNTHETIC_RANGE },
    metadata: toSongMetadata(vm.metadata),
    comments: [],
    stanzas: vm.stanzas.map((stanza): StanzaNode => ({
      title: stanzaTitle(stanza),
      // `target` es la única metadata de estrofa que la UI edita, y vive en el
      // VM (no en `stanza.node`), así que se reconstruye entera desde ahí.
      metadata: { desiredLength: entry('desiredLength', stanza.target) },
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
    metadata: fromSongMetadata(song.metadata),
    stanzas: song.stanzas.map((stanza): StanzaVm => ({
      id: crypto.randomUUID(),
      titleText: stanza.title?.text ?? '',
      rawText: printPlainLyrics({
        title: null,
        metadata: emptySongMetadata(),
        comments: [],
        stanzas: [{ ...stanza, title: null, metadata: emptyStanzaMetadata(), comments: [] }],
        range: SYNTHETIC_RANGE,
      }).trimEnd(),
      node: stanza,
      error: null,
      target: stanza.metadata.desiredLength?.value ?? null,
    })),
  };
}

/**
 * Rellena lo que le falte a un borrador guardado por una versión anterior del
 * cliente. `JsonStorage` hace `JSON.parse` a ciegas, así que un draft escrito
 * antes de que existiera la metadata llega sin ella — y sin esto el printer
 * reventaría al recorrer un `metadata` inexistente. De ahí que el parámetro sea
 * `Partial`: los tipos describen el VM de hoy, no el que escribió ese draft.
 */
export function normalizeDraft(draft: Partial<SongVm>): SongVm {
  return {
    title: draft.title ?? '',
    metadata: { ...emptySongMetadataVm(), ...draft.metadata },
    stanzas: (draft.stanzas ?? []).map(stanza => ({
      ...stanza,
      target: stanza.target ?? null,
      node: { ...stanza.node, metadata: stanza.node.metadata ?? emptyStanzaMetadata() },
    })),
  };
}
