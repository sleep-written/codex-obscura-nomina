import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * El título de la ventana / pestaña siempre lleva la marca por delante. En
 * escritorio es lo único que identifica la ventana, porque no hay barra de
 * direcciones ni menú.
 */
export const APP_NAME = 'Codex Obscura Nomina';

/** Fallback compartido con la tarjeta de borrador de la lista de canciones. */
export const UNNAMED_SONG = 'Canción sin nombre';

export function formatAppTitle(page: string | null | undefined): string {
  const trimmed = page?.trim();
  return trimmed ? `${APP_NAME}: ${trimmed}` : APP_NAME;
}

/**
 * Aplica la marca a los títulos declarados en las rutas.
 *
 * El editor NO se apoya en esto: su título depende de la canción cargada y de
 * lo que el usuario vaya escribiendo, así que lo fija él mismo con `Title` en
 * un effect. Esta estrategia corre al navegar y el effect del componente se
 * ejecuta después, así que el título dinámico es el que queda.
 */
@Injectable()
export class BrandedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(formatAppTitle(this.buildTitle(snapshot)));
  }
}
