import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LyricsParseError, parseLyrics } from '@codex-obscura-nomina/lyrics-language';
import { firstValueFrom } from 'rxjs';

import { fromSongNode } from '../lyrics/song-node';
import { randomUuid } from '../services/random-uuid';
import type { SongConflictChoice } from '../song-conflict-dialog/song-conflict-dialog';
import { SongConflictDialog } from '../song-conflict-dialog/song-conflict-dialog';
import { SongLibrary } from './song-library';
import { SongStore } from './song-store';
import type { SongVm } from './song-vm';

/**
 * Meter un `.lyrics` de fuera en la biblioteca y abrirlo.
 *
 * Vive aparte de la pantalla de canciones porque tiene dos entradas y solo una
 * es una pantalla: el `<input type="file">` de `/songs`, y el ACTION_VIEW de
 * Android cuando otra app abre un `.lyrics` (ver `native/lyrics-intent.ts`).
 * Las dos deben preguntar lo mismo y en el mismo orden — de ahi que el flujo
 * entero, dialogos incluidos, este aqui y no en el componente.
 */
@Injectable({ providedIn: 'root' })
export class SongImport {
  private readonly library = inject(SongLibrary);
  private readonly store = inject(SongStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  /**
   * Importa el contenido de un `.lyrics` y navega a el. Devuelve `false` si no
   * llego a guardarse: el texto no parseaba, o el usuario cancelo en alguno de
   * los dos dialogos.
   */
  async fromLyricsText(text: string): Promise<boolean> {
    let song: SongVm;
    try {
      song = fromSongNode(parseLyrics(text));
    } catch (error) {
      const message = error instanceof LyricsParseError ? error.message : String(error);
      alert(`No se pudo cargar el archivo: ${message}`);
      return false;
    }

    // Primero el choque y después el borrador: preguntar por trabajo que se va
    // a perder antes de saber si el archivo sirve sería pedir de más.
    const existing = this.library.findSameSong(song);
    let id: string = randomUuid();
    if (existing !== null) {
      const choice = await firstValueFrom(
        this.dialog
          .open<SongConflictDialog, unknown, SongConflictChoice | undefined>(SongConflictDialog, {
            data: {
              title: existing.song.title.trim() || 'Canción sin nombre',
              artist: existing.song.metadata.artist,
            },
          })
          .afterClosed(),
      );
      if (choice === undefined) return false;
      if (choice === 'replace') id = existing.id;
    }

    if (!this.confirmDiscard()) return false;

    try {
      this.library.put(id, song);
    } catch (error) {
      alert(`No se pudo guardar la canción importada: ${String(error)}`);
      return false;
    }
    // Se abre a mano: si la importación reemplazó la canción que ya estaba
    // abierta, navegar no bastaría para que el editor recargue su contenido.
    this.store.open(id);
    void this.router.navigate(['/editor', id]);
    return true;
  }

  /** Avisa antes de las acciones que se llevan por delante el borrador. */
  confirmDiscard(): boolean {
    if (!this.store.hasUnsavedWork()) return true;
    const title = this.store.state().title.trim() || 'Canción sin nombre';
    return confirm(`Hay cambios sin guardar en «${title}» que se van a perder. ¿Continuar?`);
  }
}
