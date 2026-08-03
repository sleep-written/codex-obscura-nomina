import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Qué hacer con una canción que choca con otra ya guardada (importar o guardar). */
export type SongConflictChoice = 'replace' | 'copy';

export interface SongConflictData {
  title: string;
  artist: string;
}

/**
 * Cerrar el diálogo sin elegir (ESC o clic fuera) cancela la acción en curso:
 * no hay botón de cancelar porque las dos que hay ya hacen algo, y una de
 * ellas sobrescribe trabajo guardado.
 */
@Component({
  selector: 'app-song-conflict-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './song-conflict-dialog.html',
  styleUrl: './song-conflict-dialog.scss',
})
export class SongConflictDialog {
  protected readonly data = inject<SongConflictData>(MAT_DIALOG_DATA);
}
