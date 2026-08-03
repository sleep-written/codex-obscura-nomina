import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppBar } from '../../shared/app-bar/app-bar';
import { UNNAMED_SONG, formatAppTitle } from '../../shared/services/app-title';
import { FileIo } from '../../shared/services/file-io';
import { lyricsFileName } from '../../shared/song/song-file';
import { SongLibrary } from '../../shared/song/song-library';
import { SongStore } from '../../shared/song/song-store';
import type { SongConflictChoice } from '../../shared/song-conflict-dialog/song-conflict-dialog';
import { SongConflictDialog } from '../../shared/song-conflict-dialog/song-conflict-dialog';
import { SongMetadataCard } from '../../shared/song-metadata-card/song-metadata-card';
import { StanzaCard } from '../../shared/stanza-card/stanza-card';

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppBar, MatButtonModule, MatIconModule, SongMetadataCard, StanzaCard],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class Editor {
  protected readonly store = inject(SongStore);
  protected readonly song = this.store.state;

  private readonly library = inject(SongLibrary);
  private readonly dialog = inject(MatDialog);
  private readonly fileIo = inject(FileIo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  constructor() {
    effect(() => {
      const id = this.params().get('id');
      if (id === null) {
        // `/editor` a secas es "canción nueva": si el editor tenía otra
        // abierta (p. ej. volviendo con el botón atrás desde `/editor/:id`),
        // manda la URL y hay que soltarla.
        if (untracked(this.store.currentId) !== null) {
          this.store.startNew();
        }
        return;
      }
      // Si ya es la canción abierta no se recarga: evita pisar cambios sin
      // guardar si el efecto se reevalúa sin que el id haya cambiado en
      // realidad.
      if (untracked(this.store.currentId) === id) return;
      if (!this.store.open(id)) {
        void this.router.navigate(['/songs']);
      }
    });

    // El título sigue a la canción mientras se edita, no solo al abrirla: si
    // cambias el nombre o el artista, la ventana se actualiza al instante.
    effect(() => {
      const song = this.song();
      const name = song.title.trim() || UNNAMED_SONG;
      const artist = song.metadata.artist.trim();
      this.title.setTitle(formatAppTitle(artist ? `${name} - ${artist}` : name));
    });
  }

  protected onTitle(title: string): void {
    this.store.setTitle(title);
  }

  // No vacía en el sitio: dejaría el `currentId` de una canción guardada
  // apuntando a un borrador vacío, y reabrirla desde la biblioteca mostraría
  // ese vacío en vez de recargar lo guardado. Se desliga del todo con
  // `startNew()` y se navega a `/editor` sin id.
  protected onClear(): void {
    if (!confirm('¿Empezar una canción nueva? Se perderá lo que no esté guardado en este editor.')) {
      return;
    }
    this.store.startNew();
    void this.router.navigate(['/editor']);
  }

  protected async onSave(): Promise<void> {
    const song = this.song();
    if (song.title.trim() === '') {
      alert('La canción necesita un título antes de guardar.');
      return;
    }

    // Mismo choque que al importar (mismo título + artista, ver
    // `isSameSong`), pero descartando la propia canción abierta: editarla sin
    // cambiar su identidad no es un choque con nadie.
    const currentId = this.store.currentId();
    const conflict = this.library.findSameSong(song);
    let targetId: string | undefined;
    if (conflict !== null && conflict.id !== currentId) {
      const choice = await firstValueFrom(
        this.dialog
          .open<SongConflictDialog, unknown, SongConflictChoice | undefined>(SongConflictDialog, {
            data: {
              title: conflict.song.title.trim() || 'Canción sin nombre',
              artist: conflict.song.metadata.artist,
            },
          })
          .afterClosed(),
      );
      if (choice === undefined) return;
      if (choice === 'replace') targetId = conflict.id;
    }

    const previousId = this.params().get('id');
    let id: string;
    try {
      id = this.store.save(targetId);
    } catch (error) {
      alert(`No se pudo guardar la canción: ${String(error)}`);
      return;
    }
    // La canción recién creada o reemplazada pasa a tener la URL de su propio
    // id, para que recargar o compartir el enlace lleve a ella.
    if (id !== previousId) {
      void this.router.navigate(['/editor', id], { replaceUrl: true });
    }
  }

  protected async onExport(): Promise<void> {
    try {
      await this.fileIo.downloadText(this.store.toLyricsText(), lyricsFileName(this.song().title));
    } catch (error) {
      alert(`No se pudo exportar la canción: ${String(error)}`);
    }
  }
}
