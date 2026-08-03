---
name: lyrics-metadata
description: Bloques de metadata `clave: valor` en la cabecera de la canción y de cada estrofa (artist/album/albumYear/trackNumber, desiredLength), en ./lyrics-language y su card en el cliente.
metadata:
  type: project
---

Desde el 2026-08-02 el DSL de [[lyrics-language-dsl]] admite metadata opcional: líneas `clave: valor` en la **cabecera** de la canción (bajo el `#`, sobre la primera estrofa) y en la cabecera de cada estrofa (bajo su `##`, sobre su primer verso). El símbolo nuevo es `:` (token `metadata-separator`).

**Claves (conjunto cerrado y validado):**

| Clave | Alcance | Valor |
|---|---|---|
| `artist`, `album`, `albumArtist` | canción | texto |
| `albumYear`, `trackNumber` | canción | entero (`^\d+$`) |
| `desiredLength` | estrofa | entero — notas por verso a las que apunta la estrofa |

**Las tres decisiones de diseño, confirmadas con el usuario antes de implementar:** conjunto cerrado y validado (no abierto ni híbrido), solo en cabeceras (no en cualquier línea), y errores estrictos. Clave desconocida, repetida, valor vacío o no numérico en clave numérica → `LyricsParseError` con línea/columna, igual que cualquier otra violación estructural.

**Los dos conjuntos de claves son disjuntos a propósito:** la clave sola determina a qué cabecera pertenece la línea, así que el `desiredLength` de una primera estrofa sin título nunca se confunde con metadata de canción. Sin eso, `desiredLength: 8` como primera línea del archivo sería ambiguo. Por lo mismo, una clave de estrofa sin estrofa abierta *abre* una estrofa sin título, igual que hace un verso suelto.

**Qué se tocó en `lyrics-language`:**
- `src/ast/interfaces/metadata.ts` (nuevo) — `MetadataEntry` (`key`/`value`/`keyRange`/`valueRange`/`range`), `SongMetadata`/`StanzaMetadata`, los specs `SONG_METADATA_SPEC`/`STANZA_METADATA_SPEC` (clave → `'text' | 'number'`, la fuente única de verdad que recorren parser, printer y `locate`), `emptySongMetadata()`/`emptyStanzaMetadata()` y `metadataSlots()`. Este último es **el único cast del feature**: los records tienen claves de una unión literal estrecha y valores tipados por clave, y ninguna de las dos cosas sobrevive a una clave ensanchada a `MetadataKey` — en vez de repetir el cast en los tres recorridos genéricos, todos pasan por ahí.
- `lyrics-tokenizer.ts` — factory `metadata-separator`, y `:` agregado a `isSymbol` para que `unknown` deje de reclamarlo. Puramente léxico: el parser es quien decide que un `:` solo significa algo como segundo token de una línea de cabecera.
- `parser.ts` — `isMetadataLine` (mira solo los dos primeros tokens: un `:` posterior es parte del valor y lo rearma `tokensToText`), `parseMetadataEntry`, `assignMetadata`. Se reemplazó la condición ad-hoc `song.title === null && song.stanzas.length === 0` por un flag `songStarted` + `extendSongRange`, porque ahora la metadata también abre el rango de la canción (y es lo que hace que un `#` bajo el bloque de metadata sea el error correcto).
- `printer.ts` — se **eliminó `classifyComments`** y en su lugar hay `printAnchored(anchors, comments)`, que intercala los comentarios entre varias líneas ancla en vez de una sola. Era obligatorio: con metadata la canción/estrofa ya no tiene una única línea propia, y un comentario dentro del bloque se habría impreso como "dangling" al final del archivo, rompiendo el round-trip. Verso/estrofa/canción usan hoy el mismo helper (el verso con un solo ancla).
- `locate.ts` — `LocateResult` gana `{ kind: 'metadata'; entry; part: 'key' | 'value'; owner }`. El `:` y los espacios no son de nadie: devuelven `none`.
- `plain-text-tokenizer.ts` — el camino de texto plano también reconoce metadata, porque si no `printPlainLyrics` la perdería en silencio. Reconoce la línea **solo donde podría ser legal** (flags `headerOpen`/`inMetadataLine`/`atLineStart`, con `headerOpen` reabierto en cada `stanza-end` y en cada `##`): así un `:` dentro de un verso normal sigue siendo inerte y no convierte ese verso en error. El valor se emite entero como **un solo token `text`** hasta fin de línea o `//` — a diferencia de un verso, no hay que silabearlo, y su puntuación y dígitos son contenido que el camino anotado también conserva.

**Orden de impresión:** las entradas se guardan como campos con nombre, así que el orden original se recupera ordenando por `range.start.line`; los empates (todo nodo sintetizado por un consumidor comparte un rango) caen al orden canónico de claves del spec, porque `sort` es estable.

**Trampa preexistente que aparece al probar esto:** el printer canonicaliza la línea en blanco entre la cabecera y la primera estrofa *borrándola* (`printSong` solo inserta `''` entre estrofas, y la cabecera no abre estrofa). Ya pasaba con el título solo; no es una regresión de la metadata. Costó dos expectativas mal escritas en los tests.

**Cliente:** `SongVm.metadata` (`SongMetadataVm`, con strings vacíos/`null` para "línea ausente") + la card `shared/song-metadata-card/`. **Esa card absorbió la cabecera de la app:** el título de la canción y los botones de archivo vivían en la `mat-toolbar` del editor y se movieron ahí a pedido del usuario, así que la toolbar (hoy `shared/app-bar/`) quedó con la marca y el botón de volver. Sus acciones son limpiar / exportar / guardar: cargar un `.lyrics` se fue a la página de la biblioteca (ver [[client-song-library]]). La card es tonta: emite `titleChanged`/`cleared`/`saved`/`exported` y la página `editor` sigue siendo la que habla con `FileIo` y `SongStore`. Nada de `placeholder` de ejemplo en los inputs — Material los muestra al enfocar el campo y se leían como datos ya guardados.

Además, `StanzaVm.target` — que antes era "solo UI, no viaja al .lyrics" — ahora persiste como el `desiredLength` de su estrofa. `normalizeDraft()` en `shared/lyrics/song-node.ts` rellena la metadata faltante de un borrador viejo (y de una canción guardada en la biblioteca, que es el mismo JSON crudo): `JsonStorage` hace `JSON.parse` a ciegas, así que sin eso un draft guardado antes de este feature reventaría al imprimir. Ver [[client-editor-state]] y [[client-architecture]].

**vscode-extension:** hover sobre clave y valor, y una regla `metadata` en `syntaxes/lyrics.tmLanguage.json` que solo matchea el set cerrado de claves (una gramática no puede saber si la línea está de verdad en una cabecera, así que colorea igual una clave escrita fuera de lugar — el parser es quien la rechaza). No hay autocompletado de claves todavía. Ver [[vscode-extension]].

**How to apply:** agregar una clave nueva es tocar su spec en `metadata.ts` + el campo en `SongMetadata`/`StanzaMetadata` + `emptyXMetadata()`, y nada más en parser/printer/locate (los tres recorren el spec). Si es de estrofa, cuidar que no colisione con las de canción. Acordarse de la regla `metadata` del tmLanguage y, si el cliente debe editarla, del VM + la card. Tests: `parser.test.ts` (describe `metadata`), `printer.test.ts`, `parse-plain-lyrics.test.ts`, `locate.test.ts`, `lyrics-tokenizer.test.ts`, y en el cliente `song-node.spec.ts`. Los fixtures `delirio-en-hyrule.{lyrics,txt}` ya llevan un bloque de metadata con un comentario intercalado, así que los round-trips byte a byte de [[lyrics-printer]] lo cubren.
