---
name: client-editor-state
description: Modelo de estado del editor del cliente — rawText vs AST, reconciliación por verso que preserva las alteraciones al editar, y por qué el printer tolera estrofas parseadas por separado.
metadata:
  type: project
---

Cómo la página del editor de [[client-architecture]] mantiene el `SongNode` en memoria mientras el
usuario escribe. Es la parte con más decisiones no obvias del cliente.

**Dos fuentes de verdad, deliberadamente separadas:**
- `rawText` (el texto crudo del textarea de cada card) es la fuente de verdad de **lo que el usuario
  escribió**.
- `node.verses` (el AST de esa estrofa) es la fuente de verdad de **las alteraciones**
  (diéresis/sinéresis/sinalefa activadas).

**Nunca realimentar el textarea desde el AST mientras el usuario edita.** `tokenizePlainLyrics`
descarta puntuación y dígitos por decisión de producto (ver [[lyrics-phonetics]]); si el textarea se
regenerara con `printPlainLyrics`, al usuario se le borrarían las comas en vivo mientras escribe. La
única vez que `rawText` se deriva del AST es al importar un `.lyrics`.

**Reconciliación verso a verso — el mecanismo central.** Al cambiar el textarea se re-parsea toda la
estrofa con `parsePlainLyrics`, lo que produce versos con el estado natural (todas las alteraciones
en su default) y borraría los toggles del usuario. Para evitarlo, los versos nuevos se emparejan
contra los anteriores por una clave de contenido (`verseKey` = texto de las palabras concatenado +
texto de los comentarios); un verso cuyo contenido no cambió **conserva su objeto anterior**, y con él
sus `marker.active`. Cada verso previo se consume como máximo una vez (importa: `@for ... track verse`
usa identidad de objeto y Angular lanza error si aparecen dos claves iguales).

**Propiedad que hace que esto funcione:** `verseKey` es invariante frente al round-trip
`AST → printPlainLyrics → parsePlainLyrics`. `printPlainLyrics` emite cada palabra como la
concatenación de sus sílabas sin separador, así que aunque el re-silabeo parta distinto, el texto de
la palabra es idéntico. Los comentarios entran en la clave a propósito: si no, editar solo el
comentario de una línea no se detectaría como cambio y quedaría pegado el comentario viejo.

**El printer casi no depende de los `range` globales.** `printer.ts` nunca lee `song.range`,
`stanza.range` ni `verse.range` salvo para clasificar comentarios (`classifyComments`), y esa
comparación de líneas ocurre siempre **dentro de un mismo nodo**. El único uso real de rangos es
`spliceInternalMarker`, que hace aritmética **relativa dentro de una sílaba**
(`marker.range.start.column - syllable.range.start.column`). Por eso se puede armar el `SongNode` de
exportación pegando estrofas parseadas de forma independiente, cada una con su numeración de líneas
desde 1, y `printLyrics` produce salida correcta. **Esto es lo que habilita la arquitectura de "una
card = un parseo independiente".** Para nodos que el cliente crea de cero se usa un rango sintético
con línea `Number.MAX_SAFE_INTEGER`, para que `classifyComments` bucketee los comentarios existentes
como "leading" (impresos antes del título), que es su ubicación natural.

**Dos cosas que el cliente copia de la librería porque no están exportadas:**
1. El mapeo `kind + active → símbolo` (`diaeresis` → `+`/`_`, `synaeresis` → `%`//`,
   `sinalefa` → `&`/espacio). `markerSymbol` es privado de `printer.ts`.
2. La aritmética de offset del `internalMarker` para partir `syllable.text` al renderizar — el texto
   de la sílaba **no contiene** el símbolo. Es el punto donde un error se ve "casi bien" (la sílaba
   correcta, el símbolo una letra corrido), así que está cubierto por tests desde ambos caminos
   (`parseLyrics` y `parsePlainLyrics`, donde los tokens sintéticos tienen `length: 0`).

**El toggle muta el AST en sitio, así que hay que forzar el recálculo.** `marker.active = !active` no
cambia ninguna referencia, por lo que un `computed()` nunca se recalcularía y la UI no reaccionaría.
Se usa `linkedSignal` (se recalcula cuando cambia el objeto verso, y además es escribible para
re-setear tras el toggle). El store, en paralelo, emite una referencia nueva del estado raíz para
disparar el autoguardado.

**La librería marca toda frontera entre palabras como sinalefa alterable**, no solo las vocal-vocal.
El cliente es tonto y renderiza lo que recibe — no filtra. Como la sinalefa inactiva imprime un
espacio (invisible), su botón necesita un ancho mínimo y un indicador sutil para seguir siendo
descubrible y tocable.

**Persistencia:** autoguardado en `localStorage` con debounce. El view-model es JSON puro
(`SongNode` y compañía son interfaces, no clases), así que `JSON.stringify`/`JSON.parse` bastan. La
restauración va envuelta en `try/catch`: un borrador corrupto o de otra versión se ignora, nunca
rompe el arranque.

**Why:** el frontend es "tonto" por diseño (ver [[lyrics-app-architecture]]) — no calcula fonética ni
decide dónde va una sílaba, solo renderiza el AST y hace flip a un booleano. La reconciliación existe
porque ese principio choca con la edición incremental: re-parsear es la única forma de mantener el AST
sincronizado con el texto, pero re-parsear destruye el trabajo del usuario. Emparejar por contenido
resuelve las dos cosas sin meterle inteligencia al frontend.

**How to apply:** cualquier cambio a cómo se sincroniza texto y AST toca `reconcile-verses.ts` /
`verse-key.ts` en `shared/lyrics/`, que son funciones puras y tienen tests — probar ahí primero. Si
aparece un bug de "se me borraron las alteraciones al escribir", el sospechoso es `verseKey` (algo que
debería ser parte de la identidad del verso no lo es, o al revés). Si aparece "el símbolo se ve
corrido dentro de la sílaba", el sospechoso es el offset de `internalMarker` en `verse-pieces.ts`.
