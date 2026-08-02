---
name: lyrics-metrics
description: Feature `metrics` de ./lyrics-language — agrupa un verso en notas cantables y calcula cuántas notas puede tener como mínimo y como máximo según sus alteraciones.
metadata:
  type: project
---

`./lyrics-language/src/metrics/` implementa el feature "metrics": utilidades puras sobre los nodos
del AST (ver [[lyrics-ast]]) que responden "¿cuántas notas canta este verso y cuánto se puede
estirar o encoger?". Nació porque el cliente (ver [[client-architecture]]) necesitaba pintar una
barra de elasticidad por verso, y la regla explícita del usuario fue: **esas utilidades van en la
librería, no en el cliente.**

**Una nota NO es una sílaba.** Una sinalefa funde sílabas de dos palabras distintas en una sola
nota; una diéresis parte una sílaba en dos. Por eso `verseMetrics` no cuenta `SyllableNode`s.

**API:**
- `verseMetrics(verse): VerseMetrics` — `{ notes, boundaries, count, min, max }`.
  - `Note.parts: NotePart[]` — una nota tiene más de un `part` solo donde un marcador está
    fusionando hoy; `part.tie` es ese marcador, para que la UI dibuje la ligadura *dentro* de la
    ficha y la haga clickeable.
  - `boundaries[i]` separa `notes[i]` de `notes[i+1]`: `marker` es el marcador alterable o `null`
    si ahí no hay nada que cambiar (`-` plano, espacio plano), y `word` dice si las dos notas son
    de palabras distintas (lo usa el cliente para dar más aire entre palabras que entre sílabas).
  - `count`/`min`/`max` — notas hoy, con todo fusionado, con todo separado.
- `stanzaMetrics(stanza)` / `songMetrics(song)` — métricas por hijo + extremos (`0`/`0` si vacío).
- `markerMerges(marker): boolean` — a diferencia de `active`, significa lo mismo para los tres
  kinds (`active` quiere decir "fusiona" en sinéresis/sinalefa pero "separa" en diéresis).

**Cómo funciona:** aplana el verso en "átomos" (los trozos de texto más chicos que un marcador
podría llegar a separar) más un "link" entre cada par. `min = átomos − links alterables`,
`max = átomos`. Los átomos salen de partir `syllable.text` en el offset del `internalMarker`
(la misma aritmética que `spliceInternalMarker` del printer, ver [[lyrics-printer]], en sentido
inverso) — es el punto donde un error se ve "casi bien" y por eso tiene test desde los dos caminos
de parseo.

**Invariante que hay que respetar: `links.length === atoms.length - 1`.** Si se rompe, las notas
salen agrupadas con el marcador equivocado. Dos trampas reales:
1. `word.trailingJoin === null` significa tanto "última palabra" como "frontera no alterable"
   (ver [[lyrics-language-dsl]]), así que el link entre palabras se empuja **por índice**
   (`index < words.length - 1`), nunca por `!== null`.
2. `addLink` rellena con un átomo vacío si llegan dos marcadores seguidos o uno antes de todo
   texto, en vez de descartar el marcador.

**Why:** el frontend es "tonto" por diseño (ver [[lyrics-app-architecture]]) — no debe decidir qué
sílabas se funden ni cuántas notas caben. Antes de esto el cliente tenía su propia copia de esa
lógica (`verse-pieces.ts` y `marker-symbol.ts`, ambos borrados); moverla acá eliminó la
duplicación que documentaba [[client-editor-state]].

**How to apply:** cualquier cuenta nueva sobre el AST (versos por estrofa, sílaba tónica, tipo de
verso) va acá, no en el cliente. Correr `npm test` en `lyrics-language` y después
`npm run build` — el cliente consume `dist/`, no `src/`.
