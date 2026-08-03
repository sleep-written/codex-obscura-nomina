import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { LyricsParseError, parseLyrics } from '@codex-obscura-nomina/lyrics-language';
import { firstValueFrom } from 'rxjs';
import { AppBar } from '../../shared/app-bar/app-bar';
import { fromSongNode } from '../../shared/lyrics/song-node';
import { FileIo } from '../../shared/services/file-io';
import { lyricsFileName, toLyricsText } from '../../shared/song/song-file';
import { SongLibrary } from '../../shared/song/song-library';
import { SongStore } from '../../shared/song/song-store';
import type { SongVm } from '../../shared/song/song-vm';
import type { ImportConflictChoice } from './import-conflict-dialog/import-conflict-dialog';
import { ImportConflictDialog } from './import-conflict-dialog/import-conflict-dialog';

/** Una canción guardada, ya en la forma que muestra la ficha. */
interface SongItem {
  id: string;
  title: string;
  details: string;
  savedAt: string;
}

function detailsOf(song: SongVm): string {
  const { artist, album, albumYear } = song.metadata;
  const year = albumYear === null ? '' : String(albumYear);
  const stanzas = song.stanzas.length;
  return [
    artist,
    album === '' ? year : year === '' ? album : `${album} (${year})`,
    stanzas === 1 ? '1 estrofa' : `${stanzas} estrofas`,
  ]
    .filter(part => part !== '')
    .join(' · ');
}

/**
 * Fecha legible sin `DatePipe`: registrar `LOCALE_ID` solo para esta línea no
 * se paga, y el formato del sistema es el que el usuario espera.
 */
function formatSavedAt(savedAt: number): string {
  return new Date(savedAt).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Component({
  selector: 'app-songs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppBar, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './songs.html',
  styleUrl: './songs.scss',
})
export class Songs {
  protected readonly store = inject(SongStore);

  private readonly library = inject(SongLibrary);
  private readonly fileIo = inject(FileIo);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected readonly songs = computed<SongItem[]>(() =>
    this.library.all().map(entry => ({
      id: entry.id,
      title: entry.song.title.trim() || 'Canción sin nombre',
      details: detailsOf(entry.song),
      savedAt: formatSavedAt(entry.savedAt),
    })),
  );

  /** Título del trabajo en curso, para la tarjeta de cambios sin guardar. */
  protected readonly draftTitle = computed(
    () => this.store.state().title.trim() || 'Canción sin nombre',
  );

  protected onNew(): void {
    if (!this.confirmDiscard()) return;
    this.store.startNew();
    void this.router.navigate(['/editor']);
  }

  protected onOpen(id: string): void {
    // Reabrir la canción que ya está abierta no pierde nada, ni siquiera sus
    // cambios sin guardar: el editor los conserva.
    if (this.store.currentId() !== id && !this.confirmDiscard()) return;
    void this.router.navigate(['/editor', id]);
  }

  /** Vuelve a lo que se estaba editando, tenga o no entrada en la biblioteca. */
  protected onContinue(): void {
    const id = this.store.currentId();
    void this.router.navigate(id === null ? ['/editor'] : ['/editor', id]);
  }

  protected onDiscard(): void {
    if (confirm(`¿Descartar los cambios sin guardar de «${this.draftTitle()}»?`)) {
      this.store.discardChanges();
    }
  }

  protected async onExport(id: string): Promise<void> {
    const saved = this.library.get(id);
    if (saved === null) return;
    try {
      await this.fileIo.downloadText(toLyricsText(saved.song), lyricsFileName(saved.song.title));
    } catch (error) {
      alert(`No se pudo exportar la canción: ${String(error)}`);
    }
  }

  protected onDuplicate(id: string): void {
    try {
      this.library.duplicate(id);
    } catch (error) {
      alert(`No se pudo duplicar la canción: ${String(error)}`);
    }
  }

  protected onDelete(item: SongItem): void {
    if (!confirm(`¿Eliminar «${item.title}»? Esta acción no se puede deshacer.`)) return;
    try {
      this.library.remove(item.id);
    } catch (error) {
      alert(`No se pudo eliminar la canción: ${String(error)}`);
      return;
    }
    // Lo que quedó abierto en el editor ya no tiene dónde volver: se convierte
    // en una canción nueva sin guardar en vez de resucitar la eliminada.
    if (this.store.currentId() === item.id) {
      this.store.detach();
    }
  }

  protected async onImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se limpia de inmediato para que elegir dos veces seguidas el mismo
    // archivo vuelva a disparar `change`. El `File` ya está capturado, así que
    // la lectura asíncrona lo sigue viendo entero.
    input.value = '';
    if (!file) return;

    let song: SongVm;
    try {
      song = fromSongNode(parseLyrics(await this.fileIo.readTextFile(file)));
    } catch (error) {
      const message = error instanceof LyricsParseError ? error.message : String(error);
      alert(`No se pudo cargar el archivo: ${message}`);
      return;
    }

    // Primero el choque y después el borrador: preguntar por trabajo que se va
    // a perder antes de saber si el archivo sirve sería pedir de más.
    const existing = this.library.findSameSong(song);
    let id: string = crypto.randomUUID();
    if (existing !== null) {
      const choice = await firstValueFrom(
        this.dialog
          .open<ImportConflictDialog, unknown, ImportConflictChoice | undefined>(
            ImportConflictDialog,
            {
              data: {
                title: existing.song.title.trim() || 'Canción sin nombre',
                artist: existing.song.metadata.artist,
              },
            },
          )
          .afterClosed(),
      );
      if (choice === undefined) return;
      if (choice === 'replace') id = existing.id;
    }

    if (!this.confirmDiscard()) return;

    try {
      this.library.put(id, song);
    } catch (error) {
      alert(`No se pudo guardar la canción importada: ${String(error)}`);
      return;
    }
    // Se abre a mano: si la importación reemplazó la canción que ya estaba
    // abierta, navegar no bastaría para que el editor recargue su contenido.
    this.store.open(id);
    void this.router.navigate(['/editor', id]);
  }

  /** Avisa antes de las acciones que se llevan por delante el borrador. */
  private confirmDiscard(): boolean {
    if (!this.store.hasUnsavedWork()) return true;
    return confirm(
      `Hay cambios sin guardar en «${this.draftTitle()}» que se van a perder. ¿Continuar?`,
    );
  }
}
