---
name: client-architecture
description: Estructura y convenciones del cliente Angular en ./client — pages/shared/stylings, rutas lazy, tema claro-oscuro por sistema, breakpoint por ancho, dependencia file: a lyrics-language.
metadata:
  type: project
---

`./client` es la app web que consume el paquete `lyrics-language` (ver [[lyrics-ast]] y
[[lyrics-printer]] para su API) para editar canciones visualmente (ver
[[lyrics-app-architecture]] para el scope y [[client-editor-state]] para el modelo de estado).

**Stack real (verificado contra `node_modules`, no asumido):** Angular **22**, Angular Material
**22.1** (M3, `mat.theme()`), CDK 22.1, TypeScript 6, builder `@angular/build:application`, tests con
**vitest** vía `@angular/build:unit-test`. Es **zoneless** (no hay `zone.js` instalado; en v22 es el
default). Standalone + signals + control flow nuevo (`@if`/`@for`/`@let`) en todo el código.

**No agregar nunca:** `@angular/animations` (Material 22 usa animaciones CSS puras y no lo tiene en
sus peer deps), `provideAnimationsAsync()`, ni `provideZonelessChangeDetection()` (redundante en v22).

**Estructura de carpetas:**
- `src/app/pages/<pagina>/` — una carpeta por página. Hoy solo `editor`, pero habrá más.
- `src/app/shared/` — todo lo genérico y reutilizable por cualquier página (componentes, funciones
  puras sobre el AST, servicios de navegador, y el store de la canción).
- `src/stylings/` — SCSS global (temas, breakpoints y `_tokens.scss` con los tokens propios que
  `mat.theme()` no cubre, hoy `--app-font-mono`), expuesto vía
  `stylePreprocessorOptions.includePaths: ["src/stylings"]` en `angular.json`, lo que permite
  `@use 'breakpoints'` desde cualquier componente.

**Regla de dependencia (la que mantiene barato agregar páginas):** `pages/* → shared/*`, **nunca al
revés**. Si un archivo de `shared/` necesita importar de `pages/`, está en la carpeta equivocada.

**Rutas lazy desde el día uno:** `app.routes.ts` usa `loadComponent`, no `component:`. Agregar la
próxima página es una línea y no engorda el bundle de las anteriores.

**Estado root vs. ruta:** el store de la canción vive en `shared/song/` con `providedIn: 'root'`, no
dentro de `pages/editor/`. La canción es el documento de la app, no un detalle del editor — futuras
páginas (métrica, vista previa) van a leer el mismo estado, y navegar entre páginas no debe perder el
trabajo.

**Tema claro/oscuro siguiendo al sistema:** `mat.theme()` ya emite todos sus tokens como
`light-dark(claro, oscuro)`, pero **Material nunca emite la propiedad `color-scheme`** — hay que
ponerla a mano (`color-scheme: light dark` en `html`). El scaffold del CLI viene con
`color-scheme: light`, que fija la app en claro y es el primer sospechoso si el modo oscuro no
responde. Los colores por tema se sobreescriben con `mat.theme-overrides()` desde `_light.scss` y
`_dark.scss` (este último dentro de `@media (prefers-color-scheme: dark)`).
**Gotcha:** `mat.theme-overrides()` descarta en silencio cualquier clave que no reconozca — un typo
en el nombre del token no da warning ni error, simplemente no hace nada.

**Breakpoint por ancho, no por orientación:** el layout de dos columnas entra en
`@media (min-width: 900px)` (mixin `wide` en `_breakpoints.scss`). Se descartó
`@media (orientation: landscape)` aunque la especificación original hablaba de "portrait/landscape",
porque un teléfono en horizontal sigue teniendo ~740px y el layout de 1/3 + 2/3 lo dejaría
inutilizable.

**Textareas:** siempre `cdkTextareaAutosize` (`@angular/cdk/text-field`), nunca redimensionables a
mano — en Android arrastrar la manija de resize es inutilizable. La directiva ya aplica
`resize: none` por su cuenta. Es zoneless-safe (su host tiene un listener `(input)` vacío solo para
agendar change detection), **pero** no reacciona a valores puestos programáticamente: tras cargar un
archivo hay que llamar `resizeToFitContent(true)` sobre un `viewChild`.

**Dependencia a la librería:** `"@codex-obscura-nomina/lyrics-language": "file:../lyrics-language"`,
mismo patrón que [[vscode-extension]]. El paquete expone `dist/`, no `src/`, así que **hay que correr
`npm run build` en `lyrics-language` tras cada cambio** para que el cliente lo vea. Los `.d.ts` se
generan con TS 7 y el cliente usa TS 6; `skipLibCheck: true` lo neutraliza.

**Why:** se eligió `file:` sobre un alias de TypeScript a `src/` para no romper el encapsulamiento —
un alias expondría `phonetics/` y `parseSong`, que hoy son deliberadamente internos (ver
[[lyrics-phonetics]]). Los servicios de navegador se escriben genéricos (no saben qué es un
`.lyrics`) para que la próxima página los reutilice sin tocarlos.

**How to apply:** antes de crear cualquier componente, decidir si es de página (`pages/`) o genérico
(`shared/`) y respetar la dirección de la dependencia. Cualquier color, breakpoint o token de tema va
en `src/stylings/`, nunca hardcodeado en el SCSS de un componente — y usar las variables de sistema de
Material (`var(--mat-sys-primary)`, `var(--mat-sys-outline)`, …) en vez de colores literales.
Ojo con el presupuesto `anyComponentStyle` de `angular.json`: avisa a los 4 kB y falla a los 8 kB.
