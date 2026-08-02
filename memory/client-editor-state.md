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

**El cliente ya no duplica nada de la librería** (era el caso hasta el 2026-08-02: `marker-symbol.ts`
copiaba el mapeo `kind + active → símbolo` y `verse-pieces.ts` la aritmética de offset del
`internalMarker`). Ambos archivos se borraron cuando esa lógica pasó a ser el feature `metrics` de la
librería — ver [[lyrics-metrics]]. Si vuelve a aparecer la tentación de calcular algo del AST en el
cliente, la respuesta es agregarlo a `metrics`.

**El toggle muta el AST en sitio, así que hay que forzar el recálculo.** `marker.active = !active` no
cambia ninguna referencia, por lo que un `computed()` nunca se recalcularía y la UI no reaccionaría.
Se usa `linkedSignal` (se recalcula cuando cambia el objeto verso, y además es escribible para
re-setear tras el toggle). El store, en paralelo, emite una referencia nueva del estado raíz para
disparar el autoguardado.

**Solo las fronteras vocal-vocal son alterables** (desde el 2026-08-02; antes la librería marcaba
*toda* frontera entre palabras y el cliente ofrecía fundir "que me", que fue como se detectó el
problema — ver [[lyrics-language-dsl]]). El cliente sigue siendo tonto: renderiza los `boundaries`
que le da `verseMetrics` y no filtra nada. Una frontera alterable pero separada se dibuja como un
botón angosto con `~`; una no alterable, como aire (más ancho si `boundary.word`).

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
corrido dentro de la sílaba", el sospechoso ya no está en el cliente: es el offset de
`internalMarker` en `verse-metrics.ts` de la librería (ver [[lyrics-metrics]]).
