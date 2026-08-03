---
name: client-song-library
description: Biblioteca de canciones del cliente — dos claves de localStorage (guardadas vs. borrador), guardado explícito, y detección de duplicados al importar un .lyrics.
metadata:
  type: project
---

Desde el 2026-08-02 el cliente ([[client-architecture]]) guarda **varias canciones** en el navegador,
no una. Antes solo existía `/editor` con un `SongVm` autoguardado, y el botón de guardar en realidad
descargaba el archivo.

**Dos claves de `localStorage`, con roles distintos:**
- `codex-obscura-nomina:library:v1` → `SavedSong[]` (`{ id, savedAt, song }`), el servicio
  `shared/song/song-library.ts`. Se escribe **solo** en acciones explícitas: guardar, importar,
  duplicar, eliminar. Todo en una sola clave a propósito: un `.lyrics` pesa unos pocos kB, y un
  índice aparte se desincroniza del contenido a la primera escritura a medias.
- `codex-obscura-nomina:song:v1` → el **borrador**: `{ song, currentId, dirty }`, autoguardado con
  debounce por `SongStore`. Es la misma clave que usaba el borrador único de antes, y `readDraft`
  detecta la forma vieja (un `SongVm` pelado, sin propiedad `song`) para no borrarle el trabajo a
  quien venía de la versión anterior.

**`currentId` + `dirty` son el par que define la UI entera.** `currentId` es qué entrada de la
biblioteca se edita (`null` = canción nueva); `dirty` es si hay cambios posteriores al último
guardado. De ahí salen el chip «sin guardar» del editor, el botón de guardar deshabilitado, la
tarjeta de borrador de la biblioteca (`hasUnsavedWork`, que además ignora un borrador vacío) y los
`confirm()` antes de las acciones que se lo llevan por delante. Todos los mutadores del store pasan
por un `mutate()` privado justamente para que nadie pueda cambiar la canción sin marcar `dirty`.

**Orden de escritura, en los dos servicios:** primero `localStorage`, después el signal
(`SongLibrary.commit`) y después `currentId`/`dirty` (`SongStore.save`). Si el almacenamiento está
lleno, `JsonStorage.write` lanza y el estado en memoria no queda diciendo que se guardó algo que no
se guardó. Por eso `JsonStorage` (antes `DraftStorage`) tiene dos escrituras: `write()` propaga el
error, `writeDebounced()` se lo traga porque es autoguardado y nadie lo pidió.

**Rutas:** `/songs` es la de arranque; `/editor` edita el borrador (canción nueva) y `/editor/:id`
abre una guardada. El editor abre por `:id` desde un `effect` sobre `paramMap`, y **se saltea la
apertura si el id ya es `currentId`** — si no, un F5 sobre `/editor/:id` machacaría los cambios sin
guardar con la versión guardada. El corolario: cuando la importación reemplaza la canción que ya
está abierta hay que llamar a `store.open(id)` a mano, porque navegar no alcanza.

**Duplicados al importar** (`isSameSong` en `shared/song/song-file.ts`): título + artista, comparados
con el mismo `slugify` que nombra el archivo exportado. Un artista vacío **no** descarta la
coincidencia (preguntar de más es mejor que duplicar en silencio), pero un título vacío sí: no hay
identidad que comparar. El diálogo ofrece reemplazar o guardar como copia, y cerrarlo cancela.

**Why:** el guardado es explícito (y no un autoguardado directo a la biblioteca) para que exista una
versión confirmada a la que volver; el borrador sigue existiendo para que un F5 no cueste trabajo.
Eliminar la canción abierta llama a `store.detach()` en vez de vaciar el editor: el trabajo sigue a
la vista, pero guardarlo crea una entrada nueva en vez de resucitar lo que el usuario borró.

**How to apply:** cualquier estado nuevo del documento va al `SongStore` y se persiste en el
borrador; cualquier cosa que deba sobrevivir a «descartar cambios» va a `SongLibrary`. Si aparece un
bug de "se me perdió lo que estaba escribiendo", el sospechoso es el orden de `open`/`mutate` o el
early-return del `effect` del editor. Ojo con el debounce de 500 ms: cerrar la pestaña justo después
de teclear pierde ese último cambio del borrador (es de siempre, no de la biblioteca).
