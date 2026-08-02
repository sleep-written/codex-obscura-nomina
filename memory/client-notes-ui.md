---
name: client-notes-ui
description: Lenguaje visual del editor del cliente — cada nota cantable es una ficha, las alteraciones son ligadura/tilde, y cada verso lleva una barra de elasticidad contra un eje común de la estrofa.
metadata:
  type: project
---

Cómo se ve la columna derecha de cada card de estrofa en `./client` (ver [[client-architecture]]
para la estructura y [[client-editor-state]] para el estado). Se rehízo el 2026-08-02 partiendo de
una imagen prototipo que trajo el usuario; el criterio fue "que se vea como un botón todo lo que
conforma una nota musical".

**Una ficha = una nota cantable.** `verse-view` itera `verseMetrics(verse).notes` (ver
[[lyrics-metrics]]), no las sílabas del AST. La ficha es un `<span>`, no un `<button>`: no tiene
acción propia y hacerla botón prometería un click que no hace nada. Lo clickeable son las
alteraciones.

**Dos estados, dos affordances opuestas:**
- **Ligadura** (dentro de la ficha, `.note__tie`): hoy fusiona; tocarla separa.
- **`~`** (entre dos fichas, `.gap--open`): hoy separa; tocarlo fusiona.
- Frontera no alterable: solo aire, más ancho si `boundary.word` (agrupa las sílabas de cada
  palabra sin dibujar nada).

Color por tipo: sinalefa en `primary`, diéresis/sinéresis en `tertiary` — distingue de un vistazo
lo que pasa entre palabras de lo que pasa dentro de una.

**La ligadura se dibuja con CSS (`border-bottom` + `border-radius`), no con el carácter `‿`
(U+203F).** Con el stack monoespaciado del sistema ese glifo cae en un fallback que lo pinta
prácticamente igual que un guión bajo — que en el DSL es `_`, el símbolo de significado contrario.
Se detectó mirando una captura real, no leyendo el código.

**Barra de elasticidad, una por verso:** cuenta de notas + un track donde se dibuja el rango
`[min, max]` (banda), la posición actual (cursor) y el objetivo (marca en `tertiary`). El eje
**es común a toda la estrofa** (`scale`, calculado en `stanza-card` con `stanzaMetrics(...).max`):
si cada verso se dibujara contra su propia escala, comparar largos entre versos no diría nada.
`max` no cambia al alternar marcadores, así que ese `computed` no necesita recalcularse tras un
toggle (a diferencia del `linkedSignal` de las métricas del verso).

**Objetivo de notas por verso (`StanzaVm.target`):** opcional, por estrofa, vive solo en el
view-model y en `localStorage` — **no viaja al `.lyrics`**, porque es una intención de trabajo, no
una propiedad de la canción. Pinta el borde izquierdo del verso: `primary` si lo cumple,
`outline-variant` si es alcanzable moviendo alteraciones, `error` si el objetivo cae fuera de
`[min, max]` (no hay forma de llegar sin reescribir el verso). Los borradores guardados antes de
esto no traen el campo, así que siempre se lee con `?? null`.

**Tokens propios en `src/stylings/_tokens.scss`** (`--app-font-mono`, stack del sistema): las
fichas y los contadores van en monoespaciado para que no bailen de ancho al cambiar de cifra. Es
el único lugar donde se define; no hardcodear fuentes en el SCSS de un componente, misma regla que
los colores.

**Why:** el prototipo mostraba fichas inertes y una barra por verso, y ambas cosas resolvían
problemas reales — la versión anterior era una línea de texto con símbolos del DSL sueltos, donde
no se distinguía una nota de otra ni se veía cuánto margen tenía un verso.

**How to apply:** cualquier dato nuevo que quiera mostrarse por verso (sílaba tónica, tipo de
verso) se calcula en la librería y se consume acá, no se calcula en el componente. Ojo con el
presupuesto `anyComponentStyle` de `angular.json` (avisa a los 4 kB); `verse-view.scss` es el
archivo más cargado del cliente.
