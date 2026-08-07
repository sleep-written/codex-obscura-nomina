import { DestroyRef, inject, Injectable } from '@angular/core';

import { FileIo } from '../services/file-io';
import { SongImport } from '../song/song-import';
import { App as CapacitorApp, PluginListenerHandle } from './plugins';

/**
 * Lo unico que sabemos leer es un archivo local. El listener tambien recibiria
 * enlaces profundos (`https://…`, esquemas propios) si algun dia los hubiera, y
 * esos no son un `.lyrics`.
 */
const LOCAL_FILE_URI = /^(content|file):/i;

/**
 * Abrir un `.lyrics` que llega desde otra app de Android — el explorador de
 * archivos, WhatsApp, el correo.
 *
 * Android entrega ese ACTION_VIEW por dos caminos segun el estado de la app, y
 * hay que cubrir los dos: si la app arranca por el intent, la URI ya viene en
 * `getLaunchUrl()` y nunca se emite ningun evento; si la app ya estaba viva,
 * llega como `appUrlOpen` y `getLaunchUrl()` no vuelve a consultarse. Nunca
 * ocurren los dos para el mismo intent.
 *
 * Los filtros que hacen que la app aparezca en «Abrir con» estan en el
 * AndroidManifest.xml de `shell/android`, no aqui.
 */
@Injectable({ providedIn: 'root' })
export class LyricsIntent {
  private readonly fileIo = inject(FileIo);
  private readonly songImport = inject(SongImport);
  private readonly destroyRef = inject(DestroyRef);

  /** Un intent a medio atender ya tiene dialogos abiertos; el siguiente espera. */
  private busy = false;

  bind(): void {
    let handle: PluginListenerHandle | null = null;
    let destroyed = false;

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => void this.open(url)).then(
      registered => {
        // El destroy puede llegar antes de que se resuelva el registro.
        if (destroyed) void registered.remove();
        else handle = registered;
      },
    );

    this.destroyRef.onDestroy(() => {
      destroyed = true;
      void handle?.remove();
    });

    void CapacitorApp.getLaunchUrl().then(result => {
      const url = result?.url;
      if (url !== undefined) void this.open(url);
    });
  }

  private async open(url: string): Promise<void> {
    if (this.busy || !LOCAL_FILE_URI.test(url)) return;
    this.busy = true;
    try {
      let text: string;
      try {
        text = await this.fileIo.readTextFileFromUri(url);
      } catch (error) {
        // El permiso de lectura sobre la URI se concede junto con el intent y
        // muere con el: un intent viejo reentregado ya no puede abrirla.
        alert(`No se pudo leer el archivo: ${String(error)}`);
        return;
      }
      await this.songImport.fromLyricsText(text);
    } finally {
      this.busy = false;
    }
  }
}
