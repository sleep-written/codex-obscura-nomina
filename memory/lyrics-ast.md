---
name: lyrics-ast
description: Implementación del parser que construye el AST (Song/Stanza/Verse/Word/Syllable) a partir de los tokens de ./lyrics-language, feature `ast`.
metadata:
  type: project
---

`./lyrics-language/src/ast/` implementa el feature "ast": consume el `Token[]` que produce [[lyrics-tokenizer]] y construye un árbol (`SongNode`) que el frontend "tonto" (ver [[lyrics-app-architecture]]) puede renderizar directamente, sin interpretar símbolos.

**Alcance:** solo cubre el camino `.lyrics` (ya anotado) → AST. El camino texto-plano → AST queda pendiente del motor de fonética/silabeo (todavía no implementado).

**Estructura:**
- `interfaces/song.ts` — `SongNode → StanzaNode[] → VerseNode[] → WordNode[] → SyllableNode[]`, más `AlterableMarker` (`{ kind: 'diaeresis'|'synaeresis'|'sinalefa', active: boolean }`) para los símbolos alterables ya resueltos.
- `lyrics-parse.error.ts` — `LyricsParseError` (mensaje + línea/columna). Convención del proyecto: cada clase de error vive en su propio archivo `nombre-fallo.error.ts`.
- `parser.ts` — `parseSong(tokens)`, con `parseVerse`/`parseWord` privados.
- `index.ts` — `parseLyrics(source: string): SongNode` (tokeniza + parsea).

**Forma del árbol:** anidado por sílaba, no un stream plano de tokens. Cada `SyllableNode` tiene `text` (grafemas, sin símbolos), `internalMarker` (marcador que NO corta sílaba: `_` diéresis-off o `%` sinéresis-on, vive dentro del texto) y `boundary` (`'separator'` para `-` plano, un `AlterableMarker` si el símbolo mismo es el corte — `+` diéresis-on o `/` sinéresis-off —, o `null` en la última sílaba de la palabra). `WordNode.trailingJoin` (kind `'sinalefa'`) cumple el rol equivalente entre palabras.

**Semántica de los símbolos alterables — sin fonética:** `+` y `/` SIEMPRE cortan sílaba (el símbolo reemplaza al `-`); `_` y `%` SIEMPRE quedan dentro de la misma sílaba (marca interna). El parser no evalúa si el par vocálico es diptongo/hiato "natural" — eso es justamente lo que permite que el import no dependa de recalcular fonética (ver [[lyrics-app-architecture]]).

**Comentarios (`//`):** `SongNode`, `StanzaNode` y `VerseNode` tienen `comments: string[]`. Regla de adjunción: un comentario en su propia línea se adjunta como comentario líder del próximo nodo estructural (título de canción/estrofa, o verso); si no hay nada después en el alcance que se cierra, se adjunta como trailing del nodo abierto más interno (verso > estrofa > canción). Un comentario "trailing" (misma línea que contenido) siempre se adjunta al nodo dueño de esa línea. Implementado en `parser.ts` con un buffer `pending: string[]` en un único pase hacia adelante sobre las líneas del archivo (ver el docstring de `parseSong`).

**Títulos multi-palabra:** `#`/`##` pueden ir seguidos de texto con espacios (ej. `# Delirio en Hyrule`), reconstruido concatenando los `.value` de los tokens hasta el siguiente `verse-end`/`stanza-end`/`comment`/EOF (`tokensToText`), no un solo token `text`.

**Why:** ver [[lyrics-language-dsl]] para el porqué del marcado obligatorio y el alcance del split `#`/`##`. La forma anidada por sílaba (en vez de un stream plano de nodos) se eligió para que el frontend "tonto" solo itere y pinte, sin tener que interpretar qué símbolo produjo qué nodo.

**How to apply:** cualquier símbolo nuevo del DSL que afecte la estructura del verso/palabra/sílaba debe reflejarse tanto en `lyrics-tokenizer.ts` (ver [[lyrics-tokenizer]]) como en `parser.ts`. Nuevas clases de error van en su propio archivo `*.error.ts` junto a `lyrics-parse.error.ts`.
