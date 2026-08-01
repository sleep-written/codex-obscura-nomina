---
name: lyrics-tokenizer
description: Implementación del tokenizer de ./lyrics-language para archivos .lyrics — motor genérico reutilizado + reglas léxicas propias del DSL.
metadata:
  type: project
---

`./lyrics-language/src/tokenizer/` implementa el feature "tokenizer": dado un archivo `.lyrics`, lo convierte en una lista de tokens.

**Estructura:**
- `character.ts`, `interfaces/`, `tokenizer.ts` — motor genérico `Tokenizer<T>` reutilizado tal cual del `parser` original (commit "Added tokenizer factory"), que ya no existe como paquete separado (fue renombrado/reemplazado por `lyrics-language`). Es un tokenizer greedy basado en factories: cada tipo de token define `close(next)` (¿acepto seguir acumulando con este próximo carácter?) y opcionalmente `hold(acum)` (para desempatar el tipo final cuando varias factories sobreviven con el mismo `close`).
- `lyrics-tokenizer.ts` — factories específicas del DSL de [[lyrics-language-dsl]], exportadas como `lyricsTokenizer`.
- `index.ts` — expone `tokenizeLyricsFile(path)` (lee un `.lyrics` del disco y tokeniza) y `lyricsTokenizer.tokenize(string)` para tokenizar strings directamente.

**Tipos de token:** `text` (letras/sílabas, vía `\p{L}`), `word-separator` (espacio), `syllable-separator` (`-`), `sinalefa` (`&`), `diaeresis-on`/`diaeresis-off` (`+`/`_`), `synaeresis-on`/`synaeresis-off` (`%`//`), `stanza-title` (`#`), `verse-end` (`\n`), `stanza-end` (`\n{2,}`), y `unknown` como categoría de respaldo para cualquier carácter no contemplado (dígitos, puntuación) — evita que el mecanismo de fallback del motor genérico (que asigna el tipo por orden de declaración cuando ninguna factory reclama el carácter) clasifique mal caracteres inesperados.

**Decisión de diseño clave:** `verse-end` y `stanza-end` comparten el mismo `close` (ambos aceptan seguir consumiendo `\n`), y se desambiguan después con `hold(acum)` según la cantidad acumulada (`length === 1` vs `length >= 2`). Así una racha de 2+ saltos de línea se colapsa en un único token `stanza-end` en vez de un `verse-end` más saltos sueltos.

**Why:** se reconstruyó el motor genérico porque ya estaba diseñado y probado en el `parser` original antes del rename a `lyrics-language`; reutilizarlo evita rediseñar el algoritmo de tokenización greedy desde cero.

**How to apply:** cualquier símbolo nuevo que se agregue al DSL (ver [[lyrics-language-dsl]]) debe reflejarse como una factory nueva en `lyrics-tokenizer.ts`, manteniendo las factories mutuamente excluyentes en su `close` para no depender del fallback de tipo del motor genérico.
