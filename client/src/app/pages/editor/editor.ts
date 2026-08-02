import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { LyricsParseError } from '@codex-obscura-nomina/lyrics-language';
import { FileIo } from '../../shared/services/file-io';
import { SongStore } from '../../shared/song/song-store';
import { StanzaCard } from '../../shared/stanza-card/stanza-card';

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatToolbarModule,
    StanzaCard,
  ],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class Editor {
  protected readonly store = inject(SongStore);
  protected readonly song = this.store.state;

  private readonly fileIo = inject(FileIo);

  protected onTitle(title: string): void {
    this.store.setTitle(title);
  }

  protected onClear(): void {
    if (confirm('¿Borrar toda la canción? Esta acción no se puede deshacer.')) {
      this.store.clear();
    }
  }

  protected onSave(): void {
    const slug = this.song()
      .title.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.fileIo.downloadText(this.store.toLyricsText(), `${slug || 'cancion'}.lyrics`);
  }

  protected async onLoad(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await this.fileIo.readTextFile(file);
      this.store.loadFromLyrics(text);
    } catch (error) {
      const message = error instanceof LyricsParseError ? error.message : String(error);
      alert(`No se pudo cargar el archivo: ${message}`);
    } finally {
      input.value = '';
    }
  }
}
