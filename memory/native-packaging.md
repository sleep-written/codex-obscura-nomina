# Empaquetado nativo (./shell)

Cómo el cliente Angular se convierte en APK de Android y ejecutable de Windows,
**sin dejar de ser una app web**.

## Por qué dos vías distintas

Capacitor cubre iOS/Android/Web; Windows no es plataforma suya. Se evaluó
`@capawesome/capacitor-electron` y se descartó: en agosto de 2026 estaba en
0.1.0, publicado tres semanas antes, con 880 descargas semanales. Y no aportaba
nada — **en escritorio la app no usa ningún plugin de Capacitor**: `<a download>`
e `<input type="file">` funcionan igual que en el navegador, y no hay botón
atrás físico. Windows va por Electron puro, con un `main.js` de ~40 líneas.

Resultado: Capacitor solo para Android.

## Reparto de dependencias

Sin npm workspaces — Angular sigue asumiendo un `package.json` por workspace de
Angular, así que meter `client/` como paquete de un npm workspace no funciona.
El repo mantiene el esquema `file:` que ya usaba `lyrics-language`.

Esto crea una tensión: esbuild empaqueta lo que se importe desde `client/src`,
pero el CLI de Capacitor descubre plugins leyendo el `package.json` contiguo a
`capacitor.config.ts` (`shell/`). El reparto reduce el solape a un solo paquete:

- `client/` → solo `@capacitor/core` (~10 kB, versión exacta).
- `shell/` → el CLI, la plataforma Android y los plugins reales.

Los plugins se declaran en `client/src/app/shared/native/plugins.ts` con
`registerPlugin` sobre interfaces mínimas escritas a mano. **Esas firmas no las
valida el compilador contra el plugin real**: al subir de versión mayor
`@capacitor/filesystem`, `share` o `app`, hay que revisar ese archivo.

## Las tres plataformas de runtime

`client/src/app/shared/native/platform.ts` es el único punto de decisión:

| | Web | Android | Electron |
|---|---|---|---|
| Routing | path | hash | hash |
| `<base href>` | `/` | `./` | `./` |
| Exportar | `<a download>` | Filesystem + share sheet | `<a download>` |
| Botón atrás | — | listener de Capacitor | — |

Detalles que no son obvios:

- **Electron se detecta por user agent** (`/\bElectron\//`), no por Capacitor:
  no lleva Capacitor, así que `isNativePlatform()` da `false` allí.
- **El hash en Electron no es cosmético**: se sirve por `file://`, donde
  `history.pushState` hacia una ruta lanza `SecurityError`.
- **En Android `<a download>` no falla, no hace nada.** Ni descarga ni lanza
  error — de ahí el puente por `Filesystem` + `Share` en `file-io.ts`.
- **El `canGoBack` del evento `backButton` no sirve** para decidir si salir:
  refleja el historial del WebView, que sigue teniendo entradas tras un
  `songs → editor → atrás`. Se compara contra la ruta actual.
- **Al automatizar pruebas en Electron, no navegues asignando `location.hash`**:
  bajo `file://` no dispara la navegación del router de Angular, y parece un bug
  de la app cuando no lo es. Hay que conducir la UI con clics reales.

## Título de la ventana

`BrandedTitleStrategy` (`client/src/app/shared/services/app-title.ts`) antepone
la marca a los títulos declarados en las rutas. El editor **no** se apoya en eso:
su título depende de la canción y de lo que se vaya escribiendo, así que lo fija
él con `Title` en un effect, que corre después de la estrategia al navegar y gana.

Aplica también al título de pestaña en web: es una sola implementación, sin
bifurcar por plataforma, porque un título con marca sirve igual en las dos.

## Builds separados

`ng build` (web) y `ng build --configuration native` escriben en carpetas
distintas (`dist/client` y `dist/native`) a propósito, para que no se pisen. La
configuración `native` es la que emite `<base href="./">`.

Las fuentes se auto-hospedan vía `angular.json > styles` (`@fontsource/roboto` y
`material-icons/iconfont/filled.css` — la variante filled, no el CSS completo
que arrastra las 5 variantes). Antes venían del CDN de Google: sin red los
`<mat-icon>` renderizaban su ligadura como texto literal.

Ver [shell/README.md](../shell/README.md) para el flujo de build y
[shell/TOOLCHAIN.md](../shell/TOOLCHAIN.md) para instalar JDK/SDK sin root.
