import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor cubre solo Android. Windows va por Electron puro en `electron/`,
 * que no necesita ningún plugin: en escritorio la app se comporta igual que en
 * el navegador.
 *
 * `webDir` apunta fuera del paquete a propósito — `client/` sigue siendo la app
 * web y no se entera de que existe este empaquetado. La configuración `native`
 * de Angular es la que emite ahí con `<base href="./">`.
 */
const config: CapacitorConfig = {
  appId: 'com.codexobscuranomina.app',
  appName: 'Codex Obscura Nomina',
  webDir: '../client/dist/native/browser',
  android: {
    // El .lyrics se exporta por el share sheet, no por descarga del WebView.
    allowMixedContent: false
  }
};

export default config;
