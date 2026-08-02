import type { StanzaNode } from '@codex-obscura-nomina/lyrics-language';

export interface StanzaVm {
  id: string;            // crypto.randomUUID(), para `@for ... track stanza.id`
  titleText: string;     // el textbox de la card
  rawText: string;       // el textarea — FUENTE DE VERDAD de lo que el usuario escribió
  node: StanzaNode;      // el AST; node.verses es la lista reconciliada
  error: string | null;  // mensaje de LyricsParseError, si el texto no parsea
}

export interface SongVm {
  title: string;
  stanzas: StanzaVm[];
}
