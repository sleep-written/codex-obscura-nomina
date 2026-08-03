import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Qué hacer con un `.lyrics` que choca con una canción ya guardada. */
export type ImportConflictChoice = 'replace' | 'copy';

export interface ImportConflictData {
  title: string;
  artist: string;
}

/**
 * Cerrar el diálogo sin elegir (ESC o clic fuera) cancela la importación: no
 * hay botón de cancelar porque las dos acciones son las que hacen algo, y una
 * de ellas sobrescribe trabajo guardado.
 */
@Component({
  selector: 'app-import-conflict-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './import-conflict-dialog.html',
  styleUrl: './import-conflict-dialog.scss',
})
export class ImportConflictDialog {
  protected readonly data = inject<ImportConflictData>(MAT_DIALOG_DATA);
}
