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

**Tipos de token:** `text` (letras/sílabas, vía `\p{L}`), `word-separator` (espacio), `syllable-separator` (`-`), `sinalefa-on`/`sinalefa-off` (`&`/`|`), `diaeresis-on`/`diaeresis-off` (`+`/`_`), `synaeresis-on`/`synaeresis-off` (`%`//`), `song-title-marker` (`#`), `stanza-title-marker` (`##`+), `comment` (`//` hasta `\n`, sin incluirlo), `verse-end` (`\n`), `stanza-end` (`\n{2,}`), y `unknown` como categoría de respaldo para cualquier carácter no contemplado (dígitos, puntuación) — evita que el mecanismo de fallback del motor genérico (que asigna el tipo por orden de declaración cuando ninguna factory reclama el carácter) clasifique mal caracteres inesperados.

**Decisiones de diseño clave:**
- `verse-end`/`stanza-end` y `song-title-marker`/`stanza-title-marker` comparten cada par el mismo `close` (ambos aceptan seguir consumiendo `\n`, o `#`, respectivamente), y se desambiguan después con `hold(acum)` según la cantidad acumulada (`length === 1` vs `length >= 2`). Así una racha de 2+ saltos de línea colapsa en un único `stanza-end`, y `#`/`##` colapsan en `song-title-marker`/`stanza-title-marker` sin necesitar dos factories con lógica distinta.
- `comment` (`//`) es la única factory con estado de instancia (clase, no objeto literal — el motor `Tokenizer` soporta pasar `new () => TokenFactory` además de `TokenFactory`), porque exigir un prefijo literal de 2 caracteres no es expresable con el `close(next)` de una sola posición que usan las demás factories, y no puede confundirse con el `/` de `synaeresis-off` (un solo `/` sin seguir de otro `/` no activa el modo comentario). Es seguro mantener estado porque el motor solo vuelve a llamar `close` de una factory ya descartada en el intento de token **siguiente**, que siempre arranca limpio.

**`LyricsToken` (tipo público):** `export type LyricsToken = Token<LyricsTokenType>` vive en `lyrics-tokenizer.ts` (junto a `LyricsTokenType`) y se reexporta desde `tokenizer/index.ts` y la raíz del paquete. Es la fuente única de verdad — antes existía un alias idéntico pero *privado y duplicado* dentro de `plain-text/plain-text-tokenizer.ts`; se eliminó ese duplicado para que ese archivo importe `LyricsToken` de aquí. Si un consumidor externo (ver [[vscode-extension]]) necesita tipar un token crudo, debe importar `LyricsToken` del paquete en vez de reconstruir `Token<LyricsTokenType>` a mano.

**Why:** se reconstruyó el motor genérico porque ya estaba diseñado y probado en el `parser` original antes del rename a `lyrics-language`; reutilizarlo evita rediseñar el algoritmo de tokenización greedy desde cero.

**How to apply:** cualquier símbolo nuevo que se agregue al DSL (ver [[lyrics-language-dsl]]) debe reflejarse como una factory nueva en `lyrics-tokenizer.ts`, manteniendo las factories mutuamente excluyentes en su `close` para no depender del fallback de tipo del motor genérico (salvo colisiones deliberadas como comment vs. synaeresis-off, resueltas por orden de declaración). Ver [[lyrics-ast]] para cómo el parser consume estos tokens.
