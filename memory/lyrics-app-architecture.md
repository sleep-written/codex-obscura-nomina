---
name: lyrics-app-architecture
description: Scope y arquitectura general de la app de lyrics — textarea + cards por estrofa, frontend "tonto" que solo renderiza un AST, import/export vía .lyrics.
metadata:
  type: project
---

Scope de la app (más allá del tokenizer aislado):

- El usuario escribe la letra de su proyecto en un textarea (texto plano, sin anotar).
- A la derecha se generan cards, una por estrofa, mostrando cada verso ya separado por sílabas musicales.
- El usuario hace clic en sílabas que admiten alteración (diéresis/sinéresis/sinalefa) para activarla/desactivarla.
- El formato `.lyrics` (ver [[lyrics-language-dsl]]) es el formato de exportación/importación del trabajo.

**El frontend es "tonto":** no tiene lógica propia, solo renderiza lo que le entrega un AST construido por una capa posterior. Esto implica dos caminos distintos que deben producir el mismo tipo de AST:

1. **Texto plano (textarea) → AST:** requiere un motor de fonética/silabeo español que calcule desde cero qué posiciones son alterables (diptongos/hiatos naturales, fronteras de palabra vocal-vocal) y su estado natural por defecto. Implementado como `parsePlainLyrics` — ver [[lyrics-phonetics]].
2. **Archivo `.lyrics` (import) → AST:** no debería depender de recalcular fonética — por eso se decidió el marcado obligatorio de diéresis/sinéresis en toda posición alterable (ver [[lyrics-language-dsl]]). Este parser solo necesita leer los símbolos ya presentes en el archivo.

**Why:** como el frontend no tiene forma de detectar ni corregir un AST mal reconstruido (es tonto, confía ciegamente en lo que le llega), el import no puede depender de que un motor de fonética recalculado coincida exactamente con el estado que existía al exportar — cualquier deriva ahí (cambios futuros en las reglas de silabeo, ambigüedad fonética) causaría que las cards se rendericen distinto a como el usuario las dejó, sin ningún error visible.

**How to apply:** al implementar el parser que construye el AST, mantener separados ambos caminos (texto plano vs. `.lyrics` ya anotado) — el primero necesita el motor de fonética, el segundo no debería necesitarlo en absoluto si el archivo está correctamente marcado. El tokenizer de [[lyrics-tokenizer]] es la base léxica compartida por ambos; el motor de fonética/silabeo del camino texto-plano vive en `src/phonetics/`+`src/plain-text/`, ver [[lyrics-phonetics]] para su diseño.
