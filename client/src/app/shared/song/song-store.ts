import { Injectable, effect, signal } from '@angular/core';
import type { Range, StanzaNode } from '@codex-obscura-nomina/lyrics-language';
import {
  LyricsParseError,
  emptyStanzaMetadata,
  parseLyrics,
  printLyrics,
} from '@codex-obscura-nomina/lyrics-language';
import { parseStanzaText } from '../lyrics/parse-stanza-text';
import { reconcileVerses } from '../lyrics/reconcile-verses';
import { fromSongNode, normalizeDraft, toSongNode } from '../lyrics/song-node';
import { DraftStorage } from '../services/draft-storage';
import type { SongMetadataVm, SongVm, StanzaVm } from './song-vm';
import { emptySongMetadataVm } from './song-vm';

const DRAFT_KEY = 'codex-obscura-nomina:song:v1';

/** Rango sintético para una estrofa creada vacía desde la UI, sin AST previo. */
const EMPTY_RANGE: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

function emptyStanzaVm(): StanzaVm {
  const node: StanzaNode = {
    title: null,
    metadata: emptyStanzaMetadata(),
    comments: [],
    verses: [],
    range: EMPTY_RANGE,
  };
  return { id: crypto.randomUUID(), titleText: '', rawText: '', node, error: null, target: null };
}

function emptySong(): SongVm {
  return { title: '', metadata: emptySongMetadataVm(), stanzas: [] };
}

@Injectable({ providedIn: 'root' })
export class SongStore {
  private readonly draft = new DraftStorage<SongVm>(DRAFT_KEY);
  private readonly song = signal<SongVm>(normalizeDraft(this.draft.read() ?? emptySong()));

  readonly state = this.song.asReadonly();

  constructor() {
    // Autoguardado: cualquier mutación produce una referencia nueva del
    // estado raíz, así que basta con leer el signal.
    effect(() => this.draft.write(this.song()));
  }

  setTitle(title: string): void {
    this.song.update(s => ({ ...s, title }));
  }

  /** Actualiza un campo de la metadata de la canción; el resto queda intacto. */
  setMetadata(patch: Partial<SongMetadataVm>): void {
    this.song.update(s => ({ ...s, metadata: { ...s.metadata, ...patch } }));
  }

  addStanza(): void {
    this.song.update(s => ({ ...s, stanzas: [...s.stanzas, emptyStanzaVm()] }));
  }

  /**
   * Inserta una estrofa vacía justo antes de la que tenga `id`. Por id y no
   * por índice, como el resto de la API: el índice de una estrofa cambia con
   * cada inserción y la plantilla ya la identifica así.
   */
  addStanzaBefore(id: string): void {
    this.song.update(s => {
      const at = s.stanzas.findIndex(stanza => stanza.id === id);
      if (at === -1) return s;
      return {
        ...s,
        stanzas: [...s.stanzas.slice(0, at), emptyStanzaVm(), ...s.stanzas.slice(at)],
      };
    });
  }

  removeStanza(id: string): void {
    this.song.update(s => ({ ...s, stanzas: s.stanzas.filter(stanza => stanza.id !== id) }));
  }

  setStanzaTitle(id: string, titleText: string): void {
    this.updateStanza(id, stanza => ({ ...stanza, titleText }));
  }

  /**
   * Notas esperadas por verso de la estrofa; `null` desactiva el objetivo.
   * Se guarda en el .lyrics como el `desiredLength` de la estrofa.
   */
  setStanzaTarget(id: string, target: number | null): void {
    this.updateStanza(id, stanza => ({ ...stanza, target }));
  }

  setStanzaText(id: string, rawText: string): void {
    this.updateStanza(id, stanza => {
      try {
        const verses = reconcileVerses(stanza.node.verses, parseStanzaText(rawText));
        return { ...stanza, rawText, node: { ...stanza.node, verses }, error: null };
      } catch (error) {
        const message = error instanceof LyricsParseError ? error.message : String(error);
        return { ...stanza, rawText, error: message };
      }
    });
  }

  markVersesChanged(): void {
    // El toggle muta el AST en sitio: no hay cambio de referencia que
    // detectar, así que forzamos una nueva referencia del estado raíz.
    this.song.update(s => ({ ...s }));
  }

  clear(): void {
    this.song.set(emptySong());
  }

  loadFromLyrics(text: string): void {
    this.song.set(fromSongNode(parseLyrics(text)));
  }

  toLyricsText(): string {
    return printLyrics(toSongNode(this.song()));
  }

  private updateStanza(id: string, update: (stanza: StanzaVm) => StanzaVm): void {
    this.song.update(s => ({
      ...s,
      stanzas: s.stanzas.map(stanza => (stanza.id === id ? update(stanza) : stanza)),
    }));
  }
}
