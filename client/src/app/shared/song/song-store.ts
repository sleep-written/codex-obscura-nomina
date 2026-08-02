import { Injectable, effect, signal } from '@angular/core';
import type { Range, StanzaNode } from '@codex-obscura-nomina/lyrics-language';
import { LyricsParseError, parseLyrics, printLyrics } from '@codex-obscura-nomina/lyrics-language';
import { parseStanzaText } from '../lyrics/parse-stanza-text';
import { reconcileVerses } from '../lyrics/reconcile-verses';
import { fromSongNode, toSongNode } from '../lyrics/song-node';
import { DraftStorage } from '../services/draft-storage';
import type { SongVm, StanzaVm } from './song-vm';

const DRAFT_KEY = 'codex-obscura-nomina:song:v1';

/** Rango sintético para una estrofa creada vacía desde la UI, sin AST previo. */
const EMPTY_RANGE: Range = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };

function emptyStanzaVm(): StanzaVm {
  const node: StanzaNode = { title: null, comments: [], verses: [], range: EMPTY_RANGE };
  return { id: crypto.randomUUID(), titleText: '', rawText: '', node, error: null, target: null };
}

function emptySong(): SongVm {
  return { title: '', stanzas: [] };
}

@Injectable({ providedIn: 'root' })
export class SongStore {
  private readonly draft = new DraftStorage<SongVm>(DRAFT_KEY);
  private readonly song = signal<SongVm>(this.draft.read() ?? emptySong());

  readonly state = this.song.asReadonly();

  constructor() {
    // Autoguardado: cualquier mutación produce una referencia nueva del
    // estado raíz, así que basta con leer el signal.
    effect(() => this.draft.write(this.song()));
  }

  setTitle(title: string): void {
    this.song.update(s => ({ ...s, title }));
  }

  addStanza(): void {
    this.song.update(s => ({ ...s, stanzas: [...s.stanzas, emptyStanzaVm()] }));
  }

  removeStanza(id: string): void {
    this.song.update(s => ({ ...s, stanzas: s.stanzas.filter(stanza => stanza.id !== id) }));
  }

  setStanzaTitle(id: string, titleText: string): void {
    this.updateStanza(id, stanza => ({ ...stanza, titleText }));
  }

  /** Notas esperadas por verso de la estrofa; `null` desactiva el objetivo. */
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
