import { Component, DestroyRef, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

import { App as CapacitorApp, PluginListenerHandle } from './shared/native/plugins';
import { isAndroid } from './shared/native/platform';

/** Ruta raíz: desde aquí el botón atrás sale de la app en vez de retroceder. */
const ROOT_ROUTE = '/songs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (isAndroid()) this.bindHardwareBackButton();
  }

  /**
   * Sin esto el botón físico de atrás cierra la app desde cualquier pantalla.
   *
   * No se usa el `canGoBack` del evento: refleja el historial del WebView, que
   * sigue teniendo entradas después de un `songs → editor → atrás`, así que
   * seguir retrocediendo daría vueltas. La ruta actual sí es determinista.
   */
  private bindHardwareBackButton(): void {
    let handle: PluginListenerHandle | null = null;
    let destroyed = false;

    void CapacitorApp.addListener('backButton', () => {
      if (this.router.url.split('?')[0] === ROOT_ROUTE) {
        void CapacitorApp.exitApp();
      } else {
        this.location.back();
      }
    }).then(registered => {
      // El destroy puede llegar antes de que se resuelva el registro.
      if (destroyed) void registered.remove();
      else handle = registered;
    });

    this.destroyRef.onDestroy(() => {
      destroyed = true;
      void handle?.remove();
    });
  }
}
