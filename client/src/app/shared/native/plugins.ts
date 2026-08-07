import { registerPlugin } from '@capacitor/core';

/**
 * Fachada de los plugins de Capacitor que usa la app (solo Android).
 *
 * Los paquetes `@capacitor/filesystem`, `@capacitor/share` y `@capacitor/app`
 * NO son dependencias de este proyecto: viven solo en `shell/`, que es donde el
 * CLI de Capacitor los descubre para cablearlos en el proyecto nativo. Aqui se
 * declaran con `registerPlugin` sobre interfaces minimas — solo los metodos que
 * la app realmente invoca.
 *
 * El coste de esta via es que las firmas no las valida el compilador contra el
 * plugin real; si se sube de version mayor alguno de los tres, hay que revisar
 * este archivo a mano.
 *
 * En web `registerPlugin` devuelve un proxy que solo falla al INVOCARSE, nunca
 * al importarse. Todas las llamadas quedan tras `isAndroid()`, asi que ni el
 * cliente web ni Electron se ven afectados.
 */

export interface PluginListenerHandle {
  remove(): Promise<void>;
}

// --- Filesystem ------------------------------------------------------------

/** Subconjunto del enum `Directory` de @capacitor/filesystem. */
export const Directory = {
  Cache: 'CACHE',
  Documents: 'DOCUMENTS'
} as const;

/** Subconjunto del enum `Encoding` de @capacitor/filesystem. */
export const Encoding = {
  UTF8: 'utf8'
} as const;

export interface FilesystemPlugin {
  writeFile(options: {
    path: string;
    data: string;
    directory?: string;
    encoding?: string;
    recursive?: boolean;
  }): Promise<{ uri: string }>;

  /**
   * Omitir `directory` es lo que hace que `path` se lea como URI absoluta —
   * la unica via para abrir un `content://` que llega de otra app, que el
   * plugin resuelve por el ContentResolver.
   *
   * Con `encoding` el puente de Android devuelve texto ya decodificado; sin el
   * devuelve base64. Aqui siempre se pide UTF-8.
   */
  readFile(options: {
    path: string;
    directory?: string;
    encoding?: string;
  }): Promise<{ data: string }>;
}

export const Filesystem = registerPlugin<FilesystemPlugin>('Filesystem');

// --- Share -----------------------------------------------------------------

export interface SharePlugin {
  share(options: {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
    dialogTitle?: string;
  }): Promise<{ activityType?: string }>;
}

export const Share = registerPlugin<SharePlugin>('Share');

// --- App -------------------------------------------------------------------

export interface AppPlugin {
  addListener(
    eventName: 'backButton',
    listener: (event: { canGoBack: boolean }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Un ACTION_VIEW recibido con la app ya viva. Es la mitad "en caliente" de
   * abrir un archivo desde otra app; la mitad en frio es `getLaunchUrl`.
   */
  addListener(
    eventName: 'appUrlOpen',
    listener: (event: { url: string }) => void
  ): Promise<PluginListenerHandle>;

  /**
   * URI del intent que abrio la app en este arranque. El plugin resuelve sin
   * datos cuando se abrio desde el launcher, asi que `url` puede faltar.
   */
  getLaunchUrl(): Promise<{ url?: string } | undefined>;

  exitApp(): Promise<void>;
}

export const App = registerPlugin<AppPlugin>('App');
