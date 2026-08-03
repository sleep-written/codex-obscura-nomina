import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import type { SongMetadataVm } from '../song/song-vm';

@Component({
  selector: 'app-song-metadata-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './song-metadata-card.html',
  styleUrl: './song-metadata-card.scss',
})
export class SongMetadataCard {
  readonly title = input.required<string>();
  readonly metadata = input.required<SongMetadataVm>();

  /** Hay cambios sin guardar en la biblioteca. */
  readonly dirty = input(false);

  readonly titleChanged = output<string>();

  /** Emite solo el campo tocado; el store hace el merge con el resto. */
  readonly changed = output<Partial<SongMetadataVm>>();

  readonly cleared = output<void>();

  /** Guardar en la biblioteca del navegador. */
  readonly saved = output<void>();

  /** Descargar la canción como archivo `.lyrics`. */
  readonly exported = output<void>();

  /**
   * Cuántos de los cinco campos del disco están puestos. El título queda
   * fuera de la cuenta a propósito: no es metadata opcional del mismo tipo
   * (es lo que nombra el archivo al guardar), y ya se ve en el encabezado.
   */
  protected readonly filled = computed(() => {
    const meta = this.metadata();
    return [meta.artist, meta.album, meta.albumArtist, meta.albumYear, meta.trackNumber].filter(
      value => value !== null && value !== '',
    ).length;
  });

  protected readonly titleMissing = computed(() => this.title().trim() === '');

  protected onText(key: 'artist' | 'album' | 'albumArtist', value: string): void {
    this.changed.emit({ [key]: value });
  }

  /**
   * Vacío, 0 o basura borran el campo en vez de dejar un número inválido: el
   * DSL solo acepta enteros positivos en `albumYear`/`trackNumber`, así que un
   * valor a medio escribir no puede llegar al AST.
   */
  protected onNumber(key: 'albumYear' | 'trackNumber', value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.changed.emit({ [key]: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
  }
}
