# shell

Empaquetado nativo del cliente Angular. **No contiene código de la app**: toma el
build de `client/` y lo envuelve.

- **Android** → Capacitor (`android/`, proyecto Gradle generado por `cap add`).
- **Windows** → Electron puro (`electron/`, subproyecto con su propio
  `package.json` y `electron-builder`).

Windows no pasa por Capacitor a propósito: en escritorio la app no usa ningún
plugin — `<a download>` e `<input type="file">` funcionan igual que en el
navegador — así que el puente no aportaba nada y añadía una dependencia de
terceros en fase 0.1.0.

## El cliente web no depende de esto

`client/` sigue siendo una app web autónoma (`npm start` → `localhost:4200`) con
sus URLs de path. Las adaptaciones nativas se activan en runtime:

| | Web | Android | Electron |
|---|---|---|---|
| Routing | path (`/editor/:id`) | hash | hash |
| `<base href>` | `/` | `./` | `./` |
| Exportar `.lyrics` | `<a download>` | Filesystem + share sheet | `<a download>` |
| Botón atrás | — | listener de Capacitor | — |

La detección vive en [`client/src/app/shared/native/platform.ts`](../client/src/app/shared/native/platform.ts).
Electron se reconoce por user agent, porque no lleva Capacitor.

## Requisitos

- Node 22+ (Capacitor 8 lo exige).
- **Android**: JDK 21 y el SDK de Android (`compileSdk 36`, AGP 8.13, Gradle 8.14.3).
  No hace falta Android Studio; basta con `cmdline-tools`.
- **Windows**: Node en Windows. El `.exe` se compila **desde Windows**, no desde
  WSL — electron-builder para targets de Windows desde Linux necesita wine y es
  frágil, además de que la firma de código no funciona.

## Flujo

Todo arranca en `sync`, que reconstruye el cliente con la configuración `native`
de Angular y reparte el resultado a las dos plataformas:

```bash
npm run sync    # ng build --configuration native → android/ y electron/app/
```

Recordatorio del monorepo: si tocaste `lyrics-language`, hay que reconstruirlo
antes (`npm --prefix ../lyrics-language run build`), porque el paquete expone
`dist/`, no `src/`.

### Android

```bash
npm run android:run     # sync + cap run android (dispositivo o emulador)
npm run android:build   # sync + cap build android (genera el APK)
npm run android:open    # abre el proyecto en Android Studio, si lo tienes
```

Para un dispositivo físico desde WSL: depuración inalámbrica (`adb pair` +
`adb connect`) o `usbipd-win` para pasar el USB.

### Windows

El paso pesado se hace en WSL y el empaquetado en Windows, porque
`electron/app/` queda autocontenido tras el sync:

```bash
# 1. En WSL
npm run sync
```

```powershell
# 2. En Windows, dentro de shell\electron\
npm install        # descarga el binario de Electron (~200 MB) via postinstall
npm run dist       # instalador NSIS + portable, en shell\electron\dist\
```

El proyecto es accesible desde Windows por
`\\wsl.localhost\<distro>\home\sleep-written\projects\codex-obscura-nomina`.
npm sobre UNC es lento; si molesta, copia `shell\electron\` a una ruta en `C:`
antes del paso 2 — es autocontenido, no necesita el resto del repo.

Para el ciclo de desarrollo en escritorio, sin empaquetar:

```bash
npm run electron:start
```

> Si lanzas Electron desde una terminal que herede `ELECTRON_RUN_AS_NODE=1`
> (pasa dentro de la terminal integrada de VSCode), el binario arranca como Node
> pelado y `require('electron')` devuelve una ruta en vez del módulo: verás
> `Cannot read properties of undefined (reading 'whenReady')`. Se resuelve con
> `env -u ELECTRON_RUN_AS_NODE npm start`.

## Pendiente: iconos

Ambas plataformas usan todavía el icono por defecto (el de Capacitor en Android,
el de Electron en Windows). `client/public/favicon.ico` no sirve como fuente:
tope en 48×48, y hacen falta 432×432 para el icono adaptativo de Android y
256×256 para el instalador de Windows.

Con un PNG en alta resolución, Android se resuelve con:

```bash
npx @capacitor/assets generate --android
```

y Windows añadiendo `"icon": "build/icon.ico"` bajo `build.win` en
`electron/package.json`.

## Qué se versiona

`android/` y `electron/main.js` sí. Se ignoran los artefactos de build y
`electron/app/`, que es una copia regenerable del build web (ver `.gitignore`).
