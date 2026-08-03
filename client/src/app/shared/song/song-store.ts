import { Injectable, computed, inject, signal } from '@angular/core';
import type { Range, StanzaNode } from '@codex-obscura-nomina/lyrics-language';
import { LyricsParseError, emptyStanzaMetadata } from '@codex-obscura-nomina/lyrics-language';
import { parseStanzaText } from '../lyrics/parse-stanza-text';
import { reconcileVerses } from '../lyrics/reconcile-verses';
import { normalizeDraft } from '../lyrics/song-node';
import { randomUuid } from '../services/random-uuid';
import { toLyricsText } from './song-file';
import { SongLibrary } from './song-library';
import type { SongMetadataVm, SongVm, StanzaVm } from './song-vm';
import { emptySongMetadataVm } from './song-vm';

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
  return { id: randomUuid(), titleText: '', rawText: '', node, error: null, target: null };
}

function emptySong(): SongVm {
  return { title: '', metadata: emptySongMetadataVm(), stanzas: [] };
}

/** Una canción en la que no hay nada que perder. */
function isEmptySong(song: SongVm): boolean {
  return (
    song.title.trim() === '' &&
    song.stanzas.length === 0 &&
    Object.values(song.metadata).every(value => value === null || value === '')
  );
}

/**
 * La canción abierta en el editor. Es el documento vivo de la app: la
 * biblioteca (`SongLibrary`) guarda versiones confirmadas, este store guarda lo
 * que el usuario está escribiendo ahora mismo, solo en memoria — un F5 lo
 * pierde, porque solo pulsar Guardar debe dejar rastro persistente.
 */
@Injectable({ providedIn: 'root' })
export class SongStore {
  private readonly library = inject(SongLibrary);

  private readonly song = signal<SongVm>(emptySong());
  private readonly currentIdFlag = signal<string | null>(null);
  private readonly dirtyFlag = signal<boolean>(false);

  readonly state = this.song.asReadonly();

  /** Id de la canción de la biblioteca que se edita; `null` si es nueva. */
  readonly currentId = this.currentIdFlag.asReadonly();

  /** Hay cambios posteriores al último guardado o apertura. */
  readonly dirty = this.dirtyFlag.asReadonly();

  /** Lo mismo, pero ignorando un borrador vacío: no hay nada que perder. */
  readonly hasUnsavedWork = computed(() => this.dirtyFlag() && !isEmptySong(this.song()));

  setTitle(title: string): void {
    this.mutate(s => ({ ...s, title }));
  }

  /** Actualiza un campo de la metadata de la canción; el resto queda intacto. */
  setMetadata(patch: Partial<SongMetadataVm>): void {
    this.mutate(s => ({ ...s, metadata: { ...s.metadata, ...patch } }));
  }

  addStanza(): void {
    this.mutate(s => ({ ...s, stanzas: [...s.stanzas, emptyStanzaVm()] }));
  }

  /**
   * Inserta una estrofa vacía justo antes de la que tenga `id`. Por id y no
   * por índice, como el resto de la API: el índice de una estrofa cambia con
   * cada inserción y la plantilla ya la identifica así.
   */
  addStanzaBefore(id: string): void {
    this.mutate(s => {
      const at = s.stanzas.findIndex(stanza => stanza.id === id);
      if (at === -1) return s;
      return {
        ...s,
        stanzas: [...s.stanzas.slice(0, at), emptyStanzaVm(), ...s.stanzas.slice(at)],
      };
    });
  }

  removeStanza(id: string): void {
    this.mutate(s => ({ ...s, stanzas: s.stanzas.filter(stanza => stanza.id !== id) }));
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
    this.mutate(s => ({ ...s }));
  }

  /** Empieza una canción nueva, desligada de la biblioteca. */
  startNew(): void {
    this.set(emptySong(), null);
  }

  /** Abre una canción guardada. `false` si el id ya no existe. */
  open(id: string): boolean {
    const saved = this.library.get(id);
    if (saved === null) return false;
    // `library.get` devuelve la referencia real de la biblioteca, no una
    // copia: sin `structuredClone` el borrador compartiría sus objetos
    // anidados (versos, marcadores), y una mutación en el sitio —como el
    // toggle de alteraciones— corrompería lo guardado sin pasar por `save()`.
    // La tolerancia de forma (JSON de una versión anterior del cliente) sigue
    // en `normalizeDraft`.
    this.set(normalizeDraft(structuredClone(saved.song)), id);
    return true;
  }

  /**
   * Escribe la canción en la biblioteca y devuelve su id. Puede lanzar si el
   * almacenamiento está lleno; por eso el estado se actualiza después del
   * `put`, para no quedar marcado como guardado sin estarlo.
   *
   * `targetId` reemplaza otra entrada de la biblioteca en vez de la actual —
   * lo usa el editor cuando el usuario elige "reemplazar" ante un choque de
   * metadata con una canción distinta a la que tenía abierta.
   */
  save(targetId?: string): string {
    const id = targetId ?? this.currentIdFlag() ?? randomUuid();
    this.library.put(id, this.song());
    this.currentIdFlag.set(id);
    this.dirtyFlag.set(false);
    return id;
  }

  /**
   * Suelta la entrada de la biblioteca sin tocar el contenido: lo que hay en
   * el editor pasa a ser una canción nueva sin guardar. Es lo que corresponde
   * cuando se borra de la biblioteca la canción abierta — el trabajo sigue a
   * la vista, pero guardarlo no debe resucitar lo que el usuario eliminó.
   */
  detach(): void {
    this.currentIdFlag.set(null);
    this.dirtyFlag.set(true);
  }

  /** Tira los cambios sin guardar: vuelve a la versión guardada, o a vacío. */
  discardChanges(): void {
    const id = this.currentIdFlag();
    if (id !== null && this.open(id)) return;
    this.startNew();
  }

  toLyricsText(): string {
    return toLyricsText(this.song());
  }

  private set(song: SongVm, currentId: string | null): void {
    this.song.set(song);
    this.currentIdFlag.set(currentId);
    this.dirtyFlag.set(false);
  }

  private mutate(update: (song: SongVm) => SongVm): void {
    this.song.update(update);
    this.dirtyFlag.set(true);
  }

  private updateStanza(id: string, update: (stanza: StanzaVm) => StanzaVm): void {
    this.mutate(s => ({
      ...s,
      stanzas: s.stanzas.map(stanza => (stanza.id === id ? update(stanza) : stanza)),
    }));
  }
}
