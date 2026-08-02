---
name: lyrics-printer
description: Serializador AST→texto `.lyrics` (`printLyrics`), inverso de parseLyrics, en `lyrics-language/src/ast/printer.ts`.
metadata:
  type: project
---

`lyrics-language/src/ast/printer.ts` implementa el camino inverso de [[lyrics-ast]]: `printLyrics(song: SongNode): string` recorre el árbol y produce texto `.lyrics` anotado, re-parseable con `parseLyrics`. Vive en `ast/` (no en un folder nuevo) porque opera sobre los mismos tipos de `song.ts` y no introduce ningún subsistema propio (sin tokens, sin fonética, sin estado) — a diferencia de `tokenizer/`/`phonetics/`/`plain-text/`, que sí encapsulan un algoritmo no trivial cada uno.

**Dos problemas resueltos que no son obvios desde la forma del AST:**

1. **Dónde va el símbolo de `internalMarker` dentro de `SyllableNode.text`.** `text` ya viene mergeado sin símbolos (ej. "fuer"), así que su posición no puede leerse del string. Se deriva de `range`: `offset = internalMarker.range.start.column - syllable.range.start.column`. Es válido porque cada carácter de texto avanza la columna en exactamente 1 y el marcador ocupa su propia columna fuera de `text` — el offset en columnas equivale exactamente al número de grafemas de `text` que lo preceden, sin importar en cuántos tokens de tipo `text` se haya partido la sílaba al tokenizar. No hay atajo fonético: reintroducir `spanish-vowels.ts` en este camino rompería la separación deliberada de [[lyrics-app-architecture]] (el camino `.lyrics`↔AST no depende de fonética).

2. **Leading vs. trailing vs. dangling en `comments: CommentNode[]`.** El AST no guarda un flag de "es trailing" — se decidió (confirmado explícitamente con el usuario, prefiriendo esto sobre agregar un campo nuevo al AST) inferirlo comparando `comment.range.start.line` contra la "línea ancla" del nodo dueño (línea de fin del título para song/stanza, `verse.range.end.line` para versos; `null` si el nodo no tiene título, caso en que todo es leading). `< ancla` → propia línea antes del nodo; `=== ancla` → pegado al final de esa línea; `> ancla` → propia línea después del nodo (dangling, solo posible en el último verso/estrofa/canción del archivo — ver el bloque de comentarios pendientes al final de `parseSong` en `parser.ts`). Es un mecanismo único (`classifyComments`) reusado en los tres niveles, sin tocar `song.ts` ni `parser.ts`: cambio 100% aditivo.

**Formato canónico emitido** (no necesariamente idéntico byte-a-byte a cualquier `.lyrics` de entrada, pero sí lo es contra `fixtures/delirio-en-hyrule.lyrics`, verificado con un test de round-trip): `# `/`## ` + texto de título (el conteo original de `#` para estrofa no se preserva — el AST no lo guarda, así que siempre se canonicaliza a exactamente `##`); `// ` + texto de comentario; una línea en blanco exacta entre estrofas, ninguna entre un header/comentario-leading y el nodo que sigue; archivo vacío → string vacío (no `'\n'` suelto).

**Why:** el "frontend tonto" ([[lyrics-app-architecture]]) solo permite al usuario togglear `active`/`kind` de markers al hacer clic en sílabas — nunca edita `text` de sílaba/comentario ni `range`. Por eso los `range` originales del parse siguen siendo una señal válida para las dos decisiones de arriba incluso después de que el usuario edite el AST en la app: ningún toggle cambia la longitud de ningún carácter, así que las relaciones de columna/línea entre nodos no se desincronizan.

**How to apply:** cualquier símbolo nuevo del DSL que afecte esta lógica debe reflejarse tanto en `printer.ts` (`markerSymbol`) como en `lyrics-tokenizer.ts`/`parser.ts` (ver [[lyrics-tokenizer]]/[[lyrics-ast]]). Tests en `printer.test.ts`: un caso por símbolo con `printLyrics(parseLyrics(snippet)) === snippet`, más un round-trip estructural (`parseLyrics(printLyrics(parseLyrics(source)))` deep-equal contra el original ignorando `range`) que atrapa errores de offset que un string "se ve bien" no atraparía, más el round-trip byte-exacto contra el fixture real.
