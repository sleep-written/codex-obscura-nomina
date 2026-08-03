import type { StanzaNode } from '@codex-obscura-nomina/lyrics-language';

/**
 * Metadata opcional de la canción, en la forma que editan los inputs de la
 * card: un string vacío o un `null` significan "esa línea no existe en el
 * .lyrics". Los campos numéricos ya vienen validados por el store, así que
 * nunca guardan el texto a medio escribir de un input.
 */
export interface SongMetadataVm {
  artist: string;
  album: string;
  albumArtist: string;
  albumYear: number | null;
  trackNumber: number | null;
}

export interface StanzaVm {
  id: string;            // randomUuid(), para `@for ... track stanza.id`
  titleText: string;     // el textbox de la card
  rawText: string;       // el textarea — FUENTE DE VERDAD de lo que el usuario escribió
  node: StanzaNode;      // el AST; node.verses es la lista reconciliada
  error: string | null;  // mensaje de LyricsParseError, si el texto no parsea
  target: number | null; // notas esperadas por verso; viaja al .lyrics como `desiredLength`
}

export interface SongVm {
  title: string;
  metadata: SongMetadataVm;
  stanzas: StanzaVm[];
}

export function emptySongMetadataVm(): SongMetadataVm {
  return { artist: '', album: '', albumArtist: '', albumYear: null, trackNumber: null };
}
