---
name: client-song-library
description: Biblioteca de canciones del cliente — una sola clave de localStorage (solo lo guardado explícitamente), y detección de duplicados al importar o guardar (mismo diálogo, `SongConflictDialog`).
metadata:
  type: project
---

Desde el 2026-08-02 el cliente ([[client-architecture]]) guarda **varias canciones** en el navegador,
no una. Antes solo existía `/editor` con un `SongVm` autoguardado, y el botón de guardar en realidad
descargaba el archivo.

Desde el 2026-08-03 ya no hay autoguardado del borrador: el usuario pidió que lo que se está
editando no quede en memoria persistente salvo que pulse Guardar explícitamente (le generaba
confusión no saber qué sobrevivía a un F5).

**Una sola clave de `localStorage`:**
- `codex-obscura-nomina:library:v1` → `SavedSong[]` (`{ id, savedAt, song }`), el servicio
  `shared/song/song-library.ts`. Se escribe **solo** en acciones explícitas: guardar, importar,
  duplicar, eliminar. Todo en una sola clave a propósito: un `.lyrics` pesa unos pocos kB, y un
  índice aparte se desincroniza del contenido a la primera escritura a medias.
- El **borrador** (`SongStore`: `song`, `currentId`, `dirty`) ya no toca `localStorage` — vive solo
  en signals, en memoria. Sigue sobreviviendo a la navegación dentro de la SPA (el servicio es
  `providedIn: 'root'`, un singleton de sesión), pero un F5 lo pierde a propósito. Ya no existe la
  clave `codex-obscura-nomina:song:v1` ni `readDraft`/`JsonStorage.writeDebounced` en `SongStore`.

**`currentId` + `dirty` son el par que define la UI entera.** `currentId` es qué entrada de la
biblioteca se edita (`null` = canción nueva); `dirty` es si hay cambios posteriores al último
guardado. De ahí salen el chip «sin guardar» del editor, el botón de guardar deshabilitado, la
tarjeta de borrador de la biblioteca (`hasUnsavedWork`, que además ignora un borrador vacío) y los
`confirm()` antes de las acciones que se lo llevan por delante. Todos los mutadores del store pasan
por un `mutate()` privado justamente para que nadie pueda cambiar la canción sin marcar `dirty`.

**Orden de escritura en `SongLibrary`:** primero `localStorage` (`JsonStorage.write`, que propaga el
error si el almacenamiento está lleno), después el signal (`commit`), y en `SongStore.save` recién
ahí `currentId`/`dirty` — para no quedar marcado como guardado sin estarlo. `JsonStorage` perdió
`writeDebounced()` al quitar el autoguardado del borrador: ahora solo tiene `read()`/`write()`.

**Rutas:** `/songs` es la de arranque; `/editor` edita el borrador (canción nueva) y `/editor/:id`
abre una guardada. El editor abre por `:id` desde un `effect` sobre `paramMap`, y **se saltea la
apertura si el id ya es `currentId`** — sin el borrador persistido, un F5 ya arranca en blanco de
todos modos, pero el guard sigue haciendo falta para no pisar cambios sin guardar cuando el mismo
`effect` reacciona de nuevo dentro de la misma sesión (p. ej. `paramMap` reemitiendo). El corolario:
cuando la importación reemplaza la canción que ya está abierta hay que llamar a `store.open(id)` a
mano, porque navegar no alcanza.

**Duplicados al importar y al guardar** (`isSameSong` en `shared/song/song-file.ts`): título +
artista, comparados con el mismo `slugify` que nombra el archivo exportado. Un artista vacío **no**
descarta la coincidencia (preguntar de más es mejor que duplicar en silencio), pero un título vacío
sí: no hay identidad que comparar. Las dos rutas comparten el mismo diálogo,
`shared/song-conflict-dialog/` (antes vivía en `pages/songs/import-conflict-dialog/` y se llamaba
`ImportConflictDialog`; se movió y renombró a `SongConflictDialog` cuando `Editor.onSave` empezó a
usarlo también). Ofrece reemplazar o guardar como copia, y cerrarlo cancela la acción en curso —
importar o guardar, según quien lo abrió. Desde el 2026-08-07 el lado de importar
no vive en `Songs` sino en `shared/song/song-import.ts`, porque tiene dos entradas:
el `<input type="file">` de `/songs` y el intent de Android que abre un `.lyrics`
desde otra app (ver [[native-packaging]]).

**`Editor.onSave` (desde 2026-08-03) exige título y revisa choques antes de guardar:**
- Con `song.title.trim() === ''` no llega a tocar la biblioteca — `alert` y corta. El botón de
  Guardar de `song-metadata-card` también se deshabilita con `titleMissing()`, pero el guard en
  `onSave` es la fuente de verdad (el botón podría reactivarse por un bug de template sin que esto
  deje de valer).
- Con título, busca `findSameSong` **descartando la propia canción abierta** (`conflict.id !==
  currentId`): editar una canción sin cambiar su identidad no es choque con nadie. Si hay choque con
  una *distinta*, se abre `SongConflictDialog`; "reemplazar" pasa el id de esa otra canción a
  `SongStore.save(targetId)` (que hasta ahora solo aceptaba `currentId ?? randomUuid()`), "guardar
  como copia" sigue el camino normal (guarda bajo su propio id), y cerrar sin elegir cancela el
  guardado entero.
- Tras guardar, si el id resultante no es el de la URL actual (canción nueva, o reemplazo de otra
  canción) se navega a `/editor/:id` con `replaceUrl`, igual que antes para canciones nuevas.

**`SongStore.open` clona en profundidad (`structuredClone`) antes de `normalizeDraft`.** Bug real que
se dio: `SongLibrary.get` devuelve la referencia interna, no una copia; `normalizeDraft` antes de esto
solo clonaba superficialmente (`{ ...stanza, node: { ...stanza.node, ... } }`), así que `node.verses`
—y los `marker` anidados en cada verso— seguían siendo los mismos objetos que los de la biblioteca.
El toggle de alteraciones muta `marker.active` **en el sitio** (ver [[client-editor-state]]), así que
sin el clon, editar una canción ya guardada corrompía en memoria la copia de la biblioteca sin que el
usuario tocara Guardar — y una escritura incidental de `SongLibrary` (duplicar o borrar *otra*
canción, que reserializa el array entero) podía persistir esa corrupción a `localStorage`. Cualquier
otro punto que lea de `SongLibrary` para meterlo en el borrador del editor necesita el mismo
`structuredClone`.

**`Editor.onClear` (antes `SongStore.clear`) ya no vacía la canción abierta en el sitio.** Vaciar en
el sitio dejaba `currentId` intacto apuntando a una canción guardada; si el usuario volvía a esa
canción desde la biblioteca, el guard "ya es la actual" del `effect` de `paramMap` (ver más abajo)
se saltaba la recarga y mostraba el vacío en vez de lo guardado — bug real reportado por el usuario.
Ahora "Vaciar" llama a `store.startNew()` (que sí desliga `currentId`) y navega a `/editor` sin id;
`SongStore` ya no tiene un método `clear()`.

**Why:** el guardado es explícito (y no un autoguardado directo a la biblioteca) para que exista una
versión confirmada a la que volver. El borrador ya no se persiste porque el usuario no quería que lo
que está a medio escribir sobreviva a un F5 sin que él lo pidiera con Guardar — antes de 2026-08-03
sí se autoguardaba con debounce, precisamente para eso, pero generaba la confusión inversa. Eliminar
la canción abierta llama a `store.detach()` en vez de vaciar el editor: el trabajo sigue a la vista,
pero guardarlo crea una entrada nueva en vez de resucitar lo que el usuario borró.

**How to apply:** cualquier estado nuevo del documento va al `SongStore` (memoria, no persiste);
cualquier cosa que deba sobrevivir a «descartar cambios» o a un F5 va a `SongLibrary` vía guardado
explícito. Si aparece un pedido de volver a autoguardar el borrador, es un cambio de producto
consciente (ver `[[client-behavior-feedback]]` si existe) y no un bug a corregir sin más. Si aparece
un bug de "se me perdió lo que estaba escribiendo" *después* de pulsar Guardar, el sospechoso es el
orden de `open`/`mutate` o el early-return del `effect` del editor.
