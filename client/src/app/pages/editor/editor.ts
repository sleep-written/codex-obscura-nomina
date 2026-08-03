import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { AppBar } from '../../shared/app-bar/app-bar';
import { FileIo } from '../../shared/services/file-io';
import { lyricsFileName } from '../../shared/song/song-file';
import { SongStore } from '../../shared/song/song-store';
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

  private readonly fileIo = inject(FileIo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  constructor() {
    effect(() => {
      const id = this.params().get('id');
      if (id === null) return;
      // Si ya es la canción abierta no se recarga: tras un F5 el borrador
      // restaurado puede tener cambios más nuevos que la versión guardada.
      if (untracked(this.store.currentId) === id) return;
      if (!this.store.open(id)) {
        void this.router.navigate(['/songs']);
      }
    });
  }

  protected onTitle(title: string): void {
    this.store.setTitle(title);
  }

  protected onClear(): void {
    if (confirm('¿Borrar toda la canción? Esta acción no se puede deshacer.')) {
      this.store.clear();
    }
  }

  protected onSave(): void {
    const isNew = this.store.currentId() === null;
    let id: string;
    try {
      id = this.store.save();
    } catch (error) {
      alert(`No se pudo guardar la canción: ${String(error)}`);
      return;
    }
    // La canción recién creada pasa a tener URL propia, para que recargar o
    // compartir el enlace lleve a ella y no a un editor en blanco.
    if (isNew) {
      void this.router.navigate(['/editor', id], { replaceUrl: true });
    }
  }

  protected onExport(): void {
    this.fileIo.downloadText(this.store.toLyricsText(), lyricsFileName(this.song().title));
  }
}
