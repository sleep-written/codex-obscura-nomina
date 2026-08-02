---
name: lyrics-language-dsl
description: Especificación del DSL de ./lyrics-language para escribir versos y estrofas en español, con control explícito de sinalefa, diéresis y sinéresis.
metadata:
  type: project
---

`./lyrics-language` implementa un DSL para escribir versos y estrofas en formato `.lyrics`. Alcance acotado solo a español (se descartó inglés y otros idiomas).

**Principio central:** nada se infiere automáticamente por fonética. Sinalefa, diéresis y sinéresis solo ocurren donde se marcan explícitamente con su símbolo; sin símbolo, el estado es el desactivado (hiato/diptongo/palabras separadas, según corresponda).

**Marcado de diéresis/sinéresis: obligatorio en toda posición alterable, no solo en desviaciones.** Toda pareja de vocales adyacentes dentro de una palabra (diptongo natural o hiato natural) debe llevar explícitamente uno de sus dos símbolos (`+`/`_` si es diptongo natural, `%`//` si es hiato natural), incluso si el usuario nunca la tocó y el resultado coincide con el estado natural. Ejemplo: "trifuerza" tiene el diptongo natural "ue" — se escribe `tri-fu_er-za` (diéresis desactivada, explícita) aunque nadie la haya alterado, no `tri-fuer-za` a secas. La sinalefa (`&`/espacio) NO sigue esta regla: se queda como estaba, sin necesidad de un símbolo de "desactivada", porque una frontera entre palabras no tiene una tercera categoría "natural" contra la cual comparar — simplemente está fusionada o no.

**Símbolos:**
| Símbolo | Función |
|---|---|
| ` ` (espacio) | Separador de palabras. También implica sinalefa desactivada — es el estado por defecto, no existe un símbolo aparte para "sinalefa desactivada". |
| `-` | Separador de sílabas. |
| `&` | Sinalefa activada (reemplaza al espacio entre las dos palabras que se funden, ej. `a&otro`). |
| `+` | Diéresis activada. |
| `_` | Diéresis desactivada. |
| `%` | Sinéresis activada. |
| `/` | Sinéresis desactivada. |
| `#` | Título de canción (opcional, solo válido como la primera línea del archivo, igual que un H1 de Markdown). |
| `##` (o más `#`) | Título de estrofa (opcional, debe ser la primera línea de su estrofa, igual que un H2 de Markdown). |
| `//` | Comentario hasta fin de línea. Puede ir en su propia línea o "trailing" después de contenido (ej. `a-ho-ra // nota`). Ver [[lyrics-ast]] para la regla de a qué nodo del AST se adjunta. |
| `\n` | Fin de verso. |
| `\n{2,}` | Fin de estrofa (2+ saltos de línea consecutivos cuentan como un solo delimitador). |

**Why:** el usuario quería control fino y explícito sobre estos fenómenos métricos en vez de detección automática por fonética, porque son ambiguos si se dejan a reglas automáticas. Se acotó a español porque la regla de ajuste ±1 por acentuación final (agudo +1 / esdrújulo -1 / llano sin cambio) es específica del español — el inglés tiene acento léxico impredecible y métrica basada en pies/sílabas tónicas, sin equivalente directo. El marcado obligatorio de diéresis/sinéresis se decidió después de definir el scope real de la app (ver [[lyrics-app-architecture]]): el `.lyrics` exportado debe ser autocontenido para que el parser de import reconstruya el AST leyendo símbolos, sin tener que re-ejecutar el motor de fonética y confiar en que coincida con lo que existía al exportar.

**How to apply:** cualquier trabajo en `./lyrics-language` (tokenizer, parser, analizador métrico) debe respetar esta tabla de símbolos tal cual. Ver [[lyrics-tokenizer]] para la implementación del tokenizer que consume este DSL, [[lyrics-ast]] para el parser que construye el AST a partir de esos tokens, [[lyrics-app-architecture]] para el porqué del marcado obligatorio, y [[local-memory-convention]] para el flujo de `memory-draft`.
