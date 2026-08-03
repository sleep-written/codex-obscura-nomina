import { Injectable, computed, signal } from '@angular/core';
import { JsonStorage } from '../services/json-storage';
import { isSameSong } from './song-file';
import type { SongVm } from './song-vm';

const LIBRARY_KEY = 'codex-obscura-nomina:library:v1';

export interface SavedSong {
  id: string;
  savedAt: number; // epoch ms del último guardado
  song: SongVm;
}

/** Descarta entradas que no tengan la forma esperada, sin tumbar el resto. */
function isSavedSong(value: unknown): value is SavedSong {
  const entry = value as Partial<SavedSong> | null;
  return (
    typeof entry?.id === 'string' &&
    typeof entry.savedAt === 'number' &&
    typeof entry.song === 'object' &&
    entry.song !== null
  );
}

/**
 * Las canciones guardadas en el navegador. Una sola clave de `localStorage`
 * con todas: un `.lyrics` pesa unos pocos kB y un índice aparte se
 * desincroniza del contenido a la primera escritura a medias.
 *
 * Solo escribe en acciones explícitas del usuario (guardar, importar,
 * duplicar, eliminar). El trabajo en curso no vive aquí, sino en el borrador
 * de `SongStore`.
 */
@Injectable({ providedIn: 'root' })
export class SongLibrary {
  private readonly storage = new JsonStorage<SavedSong[]>(LIBRARY_KEY);
  private readonly songs = signal<SavedSong[]>(this.read());

  /** Las más recientes primero, que es como las lista la página de canciones. */
  readonly all = computed(() => [...this.songs()].sort((a, b) => b.savedAt - a.savedAt));

  get(id: string): SavedSong | null {
    return this.songs().find(entry => entry.id === id) ?? null;
  }

  /** Crea o reemplaza la entrada `id`, sellándola con la fecha de ahora. */
  put(id: string, song: SongVm): SavedSong {
    const entry: SavedSong = { id, savedAt: Date.now(), song };
    this.commit([...this.songs().filter(other => other.id !== id), entry]);
    return entry;
  }

  remove(id: string): void {
    this.commit(this.songs().filter(entry => entry.id !== id));
  }

  /** Copia independiente de una canción guardada. Devuelve el id nuevo. */
  duplicate(id: string): string | null {
    const source = this.get(id);
    if (source === null) return null;
    const song = structuredClone(source.song);
    song.title = `${song.title.trim() || 'Canción sin nombre'} (copia)`;
    // Los ids de estrofa son solo para `@for ... track`, pero se regeneran
    // igual: dos documentos distintos no deben compartir identidad de nada.
    song.stanzas = song.stanzas.map(stanza => ({ ...stanza, id: crypto.randomUUID() }));
    return this.put(crypto.randomUUID(), song).id;
  }

  /**
   * La canción guardada que sería "la misma" que `song` (ver `isSameSong`), o
   * `null`. Con varias candidatas gana la más reciente, que es la que el
   * usuario tiene en la cabeza.
   */
  findSameSong(song: SongVm): SavedSong | null {
    return this.all().find(entry => isSameSong(song, entry.song)) ?? null;
  }

  /** Persiste primero: la UI nunca debe mostrar algo que no llegó al disco. */
  private commit(next: SavedSong[]): void {
    this.storage.write(next);
    this.songs.set(next);
  }

  private read(): SavedSong[] {
    const raw = this.storage.read();
    return Array.isArray(raw) ? raw.filter(isSavedSong) : [];
  }
}
