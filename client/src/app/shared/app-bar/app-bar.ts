import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';

/**
 * La barra de marca, común a todas las páginas. El contenido proyectado se
 * alinea a la derecha, para acciones propias de cada página.
 */
@Component({
  selector: 'app-app-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, RouterLink],
  templateUrl: './app-bar.html',
  styleUrl: './app-bar.scss',
})
export class AppBar {
  /** Ruta del botón de volver; sin ella no se dibuja. */
  readonly back = input<string | null>(null);
}
