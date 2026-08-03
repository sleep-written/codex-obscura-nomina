import { Capacitor } from '@capacitor/core';

/**
 * Deteccion de plataforma para las tres formas en que corre la app: navegador,
 * WebView de Android (Capacitor) y Electron en escritorio.
 */

/** `'web'` | `'android'` | `'ios'`. Electron puro reporta `'web'`. */
export function platform(): string {
  return Capacitor.getPlatform();
}

/** Solo cierto bajo Capacitor; Electron NO cuenta, ahi no hay puente nativo. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Android es la unica plataforma que necesita puentes nativos: su WebView
 * ignora `<a download>` en silencio. Electron hereda el comportamiento de
 * Chromium y se comporta igual que el navegador.
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Electron no se empaqueta con Capacitor, asi que hay que reconocerlo por el
 * user agent — Chromium le añade `Electron/<version>`.
 */
export function isElectron(): boolean {
  return /\bElectron\//.test(navigator.userAgent);
}

/**
 * En web se mantienen las URLs de path (`/editor/:id`), que es lo que hace
 * recargable y compartible un enlace.
 *
 * Empaquetada no hay servidor que reescriba a index.html, y en Electron la app
 * se sirve por `file://`, donde `history.pushState` hacia una ruta lanza
 * SecurityError. En ambos casos hace falta hash.
 */
export function usesHashRouting(): boolean {
  return isNative() || isElectron();
}
