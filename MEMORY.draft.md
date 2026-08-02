<!--
Bandeja de entrada para memoria. Normalmente aquí van notas sueltas para que las
procese y las convierta en entradas de ./memory/*.md.

AHORA MISMO contiene otra cosa: el plan de ejecución del editor del cliente.
Las notas que había aquí ya fueron consumidas el 2026-08-02 y viven en
./memory/client-architecture.md y ./memory/client-editor-state.md.
-->

# Plan de ejecución — Editor visual de lyrics en `client/`

## Protocolo para el agente ejecutor

**Lee esto completo antes de tocar nada.**

1. Este plan está dividido en **bloques**. Ejecutas **un solo bloque por sesión**, de forma síncrona,
   en orden. No adelantes trabajo de bloques posteriores aunque te parezca trivial.
2. Antes de empezar, lee `./MEMORY.md` y los archivos `./memory/client-architecture.md` y
   `./memory/client-editor-state.md`. Contienen el *porqué* de casi todas las decisiones de abajo;
   este documento es el *qué*.
3. Busca el primer bloque cuyo checkbox `[ ]` esté sin marcar. Ese es tu bloque.
4. Al terminar, corre la **Verificación** del bloque. Si falla, arréglalo antes de cerrar.
5. Marca el checkbox como `[x]`, anota en una línea qué hiciste si te desviaste del plan, y **detente**.
6. Si algo del plan es imposible o está mal, **no improvises una arquitectura alternativa**: deja el
   bloque sin marcar, describe el problema al final del bloque y detente.

**Reglas que aplican a todos los bloques:**
- `pages/*` puede importar de `shared/*`. `shared/*` **nunca** importa de `pages/*`.
- Todo en Angular 22: standalone (sin `standalone: true`, es redundante), signals, `@if`/`@for`/`@let`
  (no `CommonModule`, no `*ngIf`), `ChangeDetectionStrategy.OnPush`.
- **No agregues** `@angular/animations`, `provideAnimationsAsync()` ni
  `provideZonelessChangeDetection()`. Ya está verificado que no hacen falta y rompen suposiciones.
- Estilo: 2 espacios, comillas simples, `printWidth` 100 (ver `client/.prettierrc`).
- Nombres de archivo sin infijo `.component.`: `verse-view.ts`, no `verse-view.component.ts`.
- Colores siempre vía variables de sistema de Material (`var(--mat-sys-primary)`, etc.), nunca
  literales.

---

## Contexto mínimo (léelo, ahorra errores)

`lyrics-language/` ya está terminado y probado. El cliente **no** calcula fonética ni decide dónde va
una sílaba: solo renderiza el `SongNode` que le da la librería y hace flip a un booleano cuando el
usuario clickea. Esto es un principio de diseño, no una simplificación temporal.

**API pública de `@codex-obscura-nomina/lyrics-language`** (lo único que existe; no importes nada más):

```ts
parseLyrics(source: string): SongNode        // .lyrics anotado → AST
parsePlainLyrics(source: string): SongNode   // texto plano español → AST (calcula sílabas)
printLyrics(song: SongNode): string          // AST → .lyrics anotado
printPlainLyrics(song: SongNode): string     // AST → texto plano (pierde los símbolos)
locate(song, pos): LocateResult              // no se usa en el cliente
class LyricsParseError extends Error { readonly line: number; readonly column: number }
// tipos: SongNode, StanzaNode, VerseNode, WordNode, SyllableNode, AlterableMarker,
//        CommentNode, TitledText, Position, Range
```

**Forma del AST** (`SongNode → StanzaNode[] → VerseNode[] → WordNode[] → SyllableNode[]`):

```ts
interface AlterableMarker {
  kind: 'diaeresis' | 'synaeresis' | 'sinalefa';
  active: boolean;
  range: Range;               // SIEMPRE abarca exactamente 1 grafema
}

interface SyllableNode {
  text: string;               // grafemas SIN el símbolo del internalMarker
  internalMarker: AlterableMarker | null;   // marcador que NO corta sílaba (`_` o `%`)
  boundary: 'separator' | AlterableMarker | null;  // '-' plano | el símbolo ES el corte (`+`/`/`) | última sílaba
  range: Range;
}

interface WordNode { syllables: SyllableNode[]; trailingJoin: AlterableMarker | null; range: Range }
interface VerseNode { comments: CommentNode[]; words: WordNode[]; range: Range }
interface StanzaNode { title: TitledText | null; comments: CommentNode[]; verses: VerseNode[]; range: Range }
interface SongNode { title: TitledText | null; comments: CommentNode[]; stanzas: StanzaNode[]; range: Range }
interface Position { line: number; column: number }   // 1-indexado
interface Range { start: Position; end: Position }    // start inclusivo, end exclusivo
```

**Tabla de símbolos** (`kind` + `active` → símbolo del DSL):

| kind | `active: true` | `active: false` |
|---|---|---|
| `diaeresis` | `+` | `_` |
| `synaeresis` | `%` | `/` |
| `sinalefa` | `&` | ` ` (espacio) |

**Ejemplo concreto** — `tri-fu_er-za` (la palabra "trifuerza"):
palabra con 3 sílabas: `tri` (boundary `'separator'`), `fuer` (text `"fuer"`, `internalMarker` =
diaeresis inactiva ubicada entre la `u` y la `e`, boundary `'separator'`), `za` (boundary `null`).

---

## Estructura objetivo

```
client/src/stylings/
  _breakpoints.scss      _light.scss      _dark.scss

client/src/app/shared/
  lyrics/
    marker-symbol.ts       verse-pieces.ts (+spec)   verse-key.ts
    reconcile-verses.ts (+spec)   parse-stanza-text.ts   song-node.ts
  song/
    song-vm.ts             song-store.ts
  services/
    file-io.ts             draft-storage.ts
  verse-view/              verse-view.ts|html|scss
  stanza-card/             stanza-card.ts|html|scss

client/src/app/pages/editor/
  editor.ts|html|scss
```

---

## BLOQUE 1 — Cableado del proyecto

- [ ] Completado

**Objetivo:** que el cliente pueda importar la librería, que exista `src/stylings`, y que el tema
claro/oscuro siga al sistema. Aún no se crea ningún componente.

**Pasos:**

1. Compilar la librería (obligatorio — el paquete expone `dist/`, no `src/`):
   ```
   cd lyrics-language && npm run build
   ```

2. En `client/package.json`, dentro de `dependencies`, agregar:
   ```json
   "@codex-obscura-nomina/lyrics-language": "file:../lyrics-language"
   ```
   Luego `cd client && npm install`.

3. En `client/angular.json`, dentro de `projects.client.architect.build.options`, agregar como
   hermano de `"styles"`:
   ```json
   "stylePreprocessorOptions": {
     "includePaths": ["src/stylings"]
   }
   ```

4. Crear `client/src/stylings/_breakpoints.scss`:
   ```scss
   $wide: 900px;

   @mixin wide {
     @media (min-width: $wide) { @content; }
   }
   ```

5. Crear `client/src/stylings/_light.scss` y `client/src/stylings/_dark.scss`, ambos con esta forma
   (mapa vacío a propósito — el usuario pintará los colores después):
   ```scss
   @use '@angular/material' as mat;

   @mixin colors {
     @include mat.theme-overrides((
       // primary:   #......,
       // secondary: #......,
       // tertiary:  #......,
       // error:     #......,
     ));
   }
   ```
   > `mat.theme-overrides()` **descarta en silencio** las claves que no reconoce. Nombres válidos:
   > `primary`, `on-primary`, `primary-container`, `secondary`, `tertiary`, `error`, `on-error`,
   > `surface`, `on-surface`, `outline`, `outline-variant`, … (claves `md-sys-color` de M3).

6. Reescribir `client/src/styles.scss` completo:
   ```scss
   @use '@angular/material' as mat;
   @use 'light';
   @use 'dark';

   html {
     height: 100%;
     // REQUERIDO: mat.theme() emite valores light-dark(), pero Material nunca
     // emite `color-scheme` por su cuenta. Sin esto todo queda en tema claro.
     color-scheme: light dark;

     @include mat.theme((
       color: (
         primary: mat.$cyan-palette,
         tertiary: mat.$orange-palette,
       ),
       typography: Roboto,
       density: 0,
     ));

     @include light.colors;

     @media (prefers-color-scheme: dark) {
       @include dark.colors;
     }
   }

   body {
     margin: 0;
     height: 100%;
     background-color: var(--mat-sys-surface);
     color: var(--mat-sys-on-surface);
     font: var(--mat-sys-body-medium);
   }
   ```

**Verificación:** `cd client && npm start` levanta sin errores de Sass ni de resolución de módulos.
Agrega temporalmente `import { parseLyrics } from '@codex-obscura-nomina/lyrics-language';` en
`src/app/app.ts`, confirma que compila, y **quítalo** antes de cerrar el bloque.

---

## BLOQUE 2 — `markerSymbol` y `versePieces` (con tests)

- [ ] Completado

**Objetivo:** convertir un `VerseNode` en una lista plana de piezas renderizables. Es la pieza con más
riesgo silencioso del proyecto: un error de offset se ve "casi bien".

**Archivos:** `client/src/app/shared/lyrics/marker-symbol.ts`, `verse-pieces.ts`, `verse-pieces.spec.ts`

1. `marker-symbol.ts` (copia del mapeo privado de `printer.ts`, la librería no lo exporta):
   ```ts
   import type { AlterableMarker } from '@codex-obscura-nomina/lyrics-language';

   export function markerSymbol(marker: AlterableMarker): string {
     switch (marker.kind) {
       case 'diaeresis': return marker.active ? '+' : '_';
       case 'synaeresis': return marker.active ? '%' : '/';
       case 'sinalefa': return marker.active ? '&' : ' ';
     }
   }
   ```

2. `verse-pieces.ts`:
   ```ts
   export type VersePiece =
     | { kind: 'text'; text: string }
     | { kind: 'separator' }                                          // el '-' plano, NO clickeable
     | { kind: 'marker'; marker: AlterableMarker; symbol: string };   // clickeable
   ```

   `versePieces(verse: VerseNode): VersePiece[]` recorre `verse.words` y, dentro, `word.syllables`,
   emitiendo **en este orden exacto**:

   a. Si `syllable.internalMarker !== null`: partir `syllable.text` en el offset
   ```ts
   const offset = marker.range.start.column - syllable.range.start.column;
   const head = syllable.text.slice(0, offset);
   const tail = syllable.text.slice(offset);
   ```
   y emitir `text(head)` → `marker` → `text(tail)`, **omitiendo los `text` vacíos**.
   Si es `null`, emitir un solo `text` con `syllable.text` (si no está vacío).

   > Esta es la misma aritmética que `spliceInternalMarker` en
   > `lyrics-language/src/ast/printer.ts:63`. Es **relativa a la sílaba**, no absoluta.
   > `syllable.text` NO contiene el símbolo — por eso hay que reinsertarlo.

   b. Según `syllable.boundary`: `'separator'` → pieza `{ kind: 'separator' }`; un `AlterableMarker`
   → pieza `marker`; `null` → nada.

   c. Terminada la palabra, si `word.trailingJoin !== null`, emitir una pieza `marker` con él.

   > La librería marca **toda** frontera entre palabras como sinalefa alterable, no solo las
   > vocal-vocal. El cliente es tonto: no filtres.

3. `verse-pieces.spec.ts` — usa las funciones reales de la librería, **no mocks**:
   - `parseLyrics('# T\ntri-fu_er-za\n')` → tomar `.stanzas[0].verses[0]`, pasar por `versePieces`, y
     comprobar que concatenar las piezas (`text` → `piece.text`, `separator` → `'-'`,
     `marker` → `piece.symbol`) reconstruye exactamente `'tri-fu_er-za'`.
   - Lo mismo desde `parsePlainLyrics('trifuerza\n')`. **Este es el test que atrapa un error de
     offset**, porque en el camino de texto plano los tokens sintéticos tienen `length: 0`.
   - Un verso de dos palabras (`parsePlainLyrics('hola mundo\n')`): debe haber exactamente una pieza
     `marker` con `kind === 'sinalefa'` entre las palabras y **ninguna** después de la última.

**Verificación:** `cd client && npm test` — los specs nuevos en verde.

---

## BLOQUE 3 — `verseKey` y `reconcileVerses` (con tests)

- [ ] Completado

**Objetivo:** que editar el textarea no borre las alteraciones que el usuario ya activó en las líneas
que no tocó. Es el mecanismo central del editor.

**Archivos:** `client/src/app/shared/lyrics/verse-key.ts`, `reconcile-verses.ts`, `reconcile-verses.spec.ts`

1. `verse-key.ts`:
   ```ts
   /**
    * Identidad de contenido de un verso, invariante frente al round-trip
    * AST → printPlainLyrics → parsePlainLyrics. Ignora deliberadamente las
    * alteraciones: dos versos con el mismo texto son "el mismo verso" aunque
    * tengan toggles distintos — eso es justo lo que permite preservarlos.
    */
   export function verseKey(verse: VerseNode): string {
     const words = verse.words.map(w => w.syllables.map(s => s.text).join('')).join(' ');
     const comments = verse.comments.map(c => c.text).join('');
     return `${words} ${comments}`;
   }
   ```
   Los comentarios entran en la clave a propósito: si no, editar solo el comentario de una línea no
   se detectaría como cambio y quedaría pegado el comentario viejo.

2. `reconcile-verses.ts`:
   ```ts
   /**
    * Empareja los versos recién parseados contra los anteriores por contenido.
    * Un verso cuyo texto no cambió conserva su OBJETO anterior — y con él las
    * alteraciones que el usuario había activado. Cada verso previo se consume
    * como máximo una vez (importa: `@for ... track verse` usa identidad de
    * objeto y Angular lanza error si aparecen dos claves iguales).
    */
   export function reconcileVerses(previous: VerseNode[], next: VerseNode[]): VerseNode[] {
     const buckets = new Map<string, VerseNode[]>();
     for (const verse of previous) {
       const key = verseKey(verse);
       const bucket = buckets.get(key);
       if (bucket) { bucket.push(verse); } else { buckets.set(key, [verse]); }
     }
     return next.map(verse => buckets.get(verseKey(verse))?.shift() ?? verse);
   }
   ```

3. `reconcile-verses.spec.ts`:
   - Editar una línea de tres → las otras dos conservan identidad (`expect(...).toBe(...)`).
   - Insertar una línea al principio → todas las anteriores conservan identidad.
   - Borrar una línea del medio → las restantes conservan identidad.
   - Dos líneas idénticas en `previous` y dos en `next` → se reutilizan ambos objetos previos y no se
     repite ninguno: `expect(new Set(result).size).toBe(result.length)`.
   - **Test de round-trip (el más importante):** parsear con `parseLyrics` el fixture de abajo,
     generar su texto plano con `printPlainLyrics`, re-parsear con `parsePlainLyrics`, reconciliar
     estrofa por estrofa, y comprobar que los `marker.active` originales sobrevivieron.

   Fixture (cópialo como string literal en el spec; es
   `lyrics-language/fixtures/delirio-en-hyrule.lyrics`, y el cliente no puede leer archivos):
   ```
   // fixture de prueba para el tokenizer y el parser de AST
   # Delirio en Hyrule
   Un cuc-co&e-nor-me in-cu-bó la tri-fu_er-za
   Ga-non-dorf a/ho-ra te-je bu-fan-das de Na-vi // nombres propios sin acentuar
   Link na-da&en so-pa del Tem-plo del Ti_em-po
   y Zel-da ven-de pa-ra-gu_as en Ge-ru-do

   // segunda estrofa: el coro
   ## Coro Cósmico
   Tri-fu_er-za tri-fu_er-za dón-de te&es-con-dis-te
   De-ba-jo del som-bre-ro de&un De-ku tris-te
   ```

**Verificación:** `cd client && npm test` — todo en verde.

---

## BLOQUE 4 — View-model y puentes con el AST

- [ ] Completado

**Objetivo:** las funciones que conectan el textarea con el AST y el AST con el archivo. Sin tests
propios (los cubren los bloques 2, 3 y la verificación final).

**Archivos:** `client/src/app/shared/song/song-vm.ts`, `client/src/app/shared/lyrics/parse-stanza-text.ts`,
`client/src/app/shared/lyrics/song-node.ts`

1. `song-vm.ts`:
   ```ts
   export interface StanzaVm {
     id: string;            // crypto.randomUUID(), para `@for ... track stanza.id`
     titleText: string;     // el textbox de la card
     rawText: string;       // el textarea — FUENTE DE VERDAD de lo que el usuario escribió
     node: StanzaNode;      // el AST; node.verses es la lista reconciliada
     error: string | null;  // mensaje de LyricsParseError, si el texto no parsea
   }

   export interface SongVm {
     title: string;
     stanzas: StanzaVm[];
   }
   ```

2. `parse-stanza-text.ts`:
   ```ts
   /**
    * Texto crudo de un textarea → versos. Sanea antes de parsear porque el
    * textarea de una card representa UNA estrofa:
    *  - las líneas en blanco crearían una segunda estrofa (`stanza-end`);
    *  - un '#' al inicio de línea crearía un título, que tiene su propio textbox.
    */
   export function parseStanzaText(rawText: string): VerseNode[] {
     const sanitized = rawText
       .split('\n')
       .map(line => line.replace(/^\s*#+\s?/, ''))
       .filter(line => line.trim().length > 0)
       .join('\n');

     if (sanitized.length === 0) return [];
     return parsePlainLyrics(sanitized).stanzas[0]?.verses ?? [];
   }
   ```
   Quien la llame debe envolverla en `try/catch` para `LyricsParseError` (expone `.line`, `.column`, y
   un `.message` que ya los incluye).

3. `song-node.ts`:
   ```ts
   /**
    * Rango sintético para nodos que el cliente crea de cero. La línea es
    * deliberadamente enorme: `classifyComments` del printer bucketea los
    * comentarios comparando su línea contra la del título, y con una línea
    * altísima todos caen en "leading" (se imprimen antes del título), que es
    * la ubicación natural.
    */
   const SYNTHETIC_RANGE: Range = {
     start: { line: Number.MAX_SAFE_INTEGER, column: 1 },
     end: { line: Number.MAX_SAFE_INTEGER, column: 1 },
   };
   ```

   `toSongNode(vm: SongVm): SongNode` — arma el nodo para `printLyrics`:
   - `title`: `null` si `vm.title.trim()` está vacío; si no `{ text: vm.title.trim(), range: SYNTHETIC_RANGE }`.
   - `comments`: `[]`. `range`: `SYNTHETIC_RANGE`.
   - Cada estrofa: `{ title, comments: s.node.comments, verses: s.node.verses, range: s.node.range }`,
     donde `title` reutiliza `s.node.title?.range` si existía, y `SYNTHETIC_RANGE` si el usuario le
     agregó un título a una estrofa que no lo tenía.

   > Esto es seguro aunque cada estrofa venga de un parseo independiente con su propia numeración de
   > líneas: el printer solo usa rangos para (a) aritmética **relativa dentro de una sílaba** y (b)
   > clasificar comentarios comparando líneas **dentro de un mismo nodo**.

   `fromSongNode(song: SongNode): SongVm` — para el import:
   - `title` ← `song.title?.text ?? ''`.
   - Por estrofa: `id` ← `crypto.randomUUID()`; `titleText` ← `stanza.title?.text ?? ''`;
     `error` ← `null`; `node` ← **la estrofa tal cual, sin re-parsear** (los `marker.active` del
     archivo se conservan intactos).
   - `rawText` ← `printPlainLyrics({ title: null, comments: [], stanzas: [{ ...stanza, title: null,
     comments: [] }], range: SYNTHETIC_RANGE })`, con `.trimEnd()`.

   > Se anulan `title` y `comments` de estrofa al derivar `rawText` para que no se dupliquen: viven en
   > `titleText` y en `node.comments`. Los comentarios **de verso** sí salen en el `rawText`, y eso es
   > correcto: al re-parsear vuelven a adjuntarse al mismo verso y `verseKey` los reconoce.

**Verificación:** `cd client && npm test` sigue en verde y `npm start` compila. Nada visual todavía.

---

## BLOQUE 5 — Componente `VerseView`

- [ ] Completado

**Objetivo:** renderizar un verso y manejar los clicks. Es el **único** lugar donde se muta el AST.

**Archivos:** `client/src/app/shared/verse-view/verse-view.ts|html|scss`

```ts
@Component({
  selector: 'app-verse-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verse-view.html',
  styleUrl: './verse-view.scss',
})
export class VerseView {
  readonly verse = input.required<VerseNode>();
  readonly changed = output<void>();

  // linkedSignal: se recalcula cuando cambia el objeto `verse`, y además es
  // escribible para poder recalcular tras un toggle (que muta el AST en sitio
  // y por tanto es invisible para el sistema de señales).
  protected readonly pieces = linkedSignal(() => versePieces(this.verse()));

  protected toggle(marker: AlterableMarker): void {
    marker.active = !marker.active;
    this.pieces.set(versePieces(this.verse()));
    this.changed.emit();
  }
}
```

> **NO reemplaces `linkedSignal` por `computed`.** El toggle muta `marker.active` sin cambiar la
> referencia de `verse`, así que un `computed` nunca se recalcularía y la UI no reaccionaría.

`verse-view.html`:
```html
<div class="verse">
  @for (piece of pieces(); track $index) {
    @switch (piece.kind) {
      @case ('text') { <span class="verse__text">{{ piece.text }}</span> }
      @case ('separator') { <span class="verse__sep">-</span> }
      @case ('marker') {
        <button
          type="button"
          class="verse__marker"
          [class.verse__marker--active]="piece.marker.active"
          [attr.data-kind]="piece.marker.kind"
          [attr.aria-pressed]="piece.marker.active"
          [attr.aria-label]="piece.marker.kind"
          (click)="toggle(piece.marker)">{{ piece.symbol }}</button>
      }
    }
  }
</div>
```
`track $index` es correcto aquí: las piezas se regeneran completas en cada cambio y no hay estado de
DOM que preservar.

`verse-view.scss`:
- `.verse`: `display: flex; flex-wrap: wrap; align-items: baseline;`
- `.verse__marker`: `<button>` reseteado (sin borde ni fondo), `cursor: pointer`,
  `min-width`/`min-height` ≥ `1.75rem` para que sea tocable en móvil,
  color `var(--mat-sys-primary)` cuando activo / `var(--mat-sys-outline)` cuando no.
- La sinalefa inactiva imprime un espacio (invisible). Dale a
  `.verse__marker[data-kind='sinalefa']:not(.verse__marker--active)` un ancho mínimo y un indicador
  sutil (p. ej. `border-bottom: 1px dotted var(--mat-sys-outline-variant)`) para que siga siendo
  descubrible y clickeable.

**Verificación:** compila (`npm start`). Aún no hay nada que lo use.

---

## BLOQUE 6 — Componente `StanzaCard`

- [ ] Completado

**Objetivo:** la card completa: textbox de nombre, textarea autoajustable y los versos silabeados.
Es un componente **de presentación**: no muta el estado global, solo emite eventos.

**Archivos:** `client/src/app/shared/stanza-card/stanza-card.ts|html|scss`

API:
```ts
readonly stanza = input.required<StanzaVm>();
readonly titleChanged = output<string>();
readonly textChanged = output<string>();
readonly versesChanged = output<void>();   // reenvía el `changed` de VerseView
readonly removed = output<void>();
```

`stanza-card.html`:
```html
<mat-card class="stanza">
  <mat-card-content class="stanza__body">
    <div class="stanza__input">
      <mat-form-field appearance="outline" class="stanza__field">
        <mat-label>Nombre de la estrofa</mat-label>
        <input matInput [value]="stanza().titleText"
               (input)="titleChanged.emit($any($event.target).value)">
      </mat-form-field>

      <mat-form-field appearance="outline" class="stanza__field">
        <mat-label>Letra</mat-label>
        <textarea matInput cdkTextareaAutosize cdkAutosizeMinRows="4"
                  [value]="stanza().rawText"
                  (input)="textChanged.emit($any($event.target).value)"></textarea>
      </mat-form-field>

      @if (stanza().error; as error) {
        <p class="stanza__error">{{ error }}</p>
      }
    </div>

    <div class="stanza__verses">
      @for (verse of stanza().node.verses; track verse) {
        <app-verse-view [verse]="verse" (changed)="versesChanged.emit()" />
      } @empty {
        <p class="stanza__empty">Escribe la letra para ver las sílabas.</p>
      }
    </div>
  </mat-card-content>
</mat-card>
```
(Agrega también un botón de eliminar que dispare `removed`.)

**Detalles que importan:**
- `cdkTextareaAutosize` viene de `@angular/cdk/text-field` (directiva standalone `CdkTextareaAutosize`,
  impórtala directa, no hace falta `TextFieldModule`). Ya aplica `resize: none` — **no lo pongas a
  mano**.
- Es zoneless-safe, **pero** no reacciona a valores puestos programáticamente (sin evento `input`).
  Guarda un `viewChild(CdkTextareaAutosize)` y llama `resizeToFitContent(true)` desde un `effect()`
  que lea `stanza().rawText`, para que tras cargar un archivo el textarea tenga la altura correcta.
- `track verse` (identidad de objeto) es exactamente lo correcto: la reconciliación garantiza que los
  versos sin cambios mantienen su objeto y que nunca hay duplicados.
- `$any($event.target).value` es necesario: `noPropertyAccessFromIndexSignature` está activo y
  `EventTarget` no tiene `.value`.

`stanza-card.scss`:
```scss
@use 'breakpoints' as bp;

.stanza__body {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;       // portrait: todo a lo ancho

  @include bp.wide {
    grid-template-columns: 1fr 2fr; // landscape: 1/3 izquierda, 2/3 derecha
    align-items: start;
  }
}
```
El campo de error usa `var(--mat-sys-error)`. Mantén el SCSS acotado: el presupuesto
`anyComponentStyle` avisa a los 4 kB y falla a los 8 kB.

**Verificación:** compila. Aún no hay página que lo use.

---

## BLOQUE 7 — Servicios y `SongStore`

- [ ] Completado

**Objetivo:** el estado y la E/S. Los dos servicios de `shared/services/` se escriben **genéricos a
propósito** (no saben qué es un `.lyrics`) para que futuras páginas los reutilicen.

**Archivos:** `client/src/app/shared/services/file-io.ts`, `draft-storage.ts`,
`client/src/app/shared/song/song-store.ts`

1. `file-io.ts` — enfoque clásico; es el único que funciona en Chrome de Android (la File System
   Access API es solo de escritorio):
   ```ts
   async readTextFile(file: File): Promise<string> { return file.text(); }

   downloadText(text: string, filename: string): void {
     const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     a.click();
     URL.revokeObjectURL(url);
   }
   ```

2. `draft-storage.ts` — `DraftStorage<T>` con `read(): T | null` y `write(value: T): void`,
   parametrizado por la clave. Debounce de ~500 ms en `write` (`setTimeout` es seguro en zoneless).
   `read` va envuelto en `try/catch`: si el JSON es inválido o de otra versión, devuelve `null` y se
   empieza vacío. **Un borrador corrupto nunca debe romper el arranque.**

3. `song-store.ts` — `@Injectable({ providedIn: 'root' })` con un único `signal<SongVm>`, expuesto
   como `asReadonly()`. Clave de persistencia: `codex-obscura-nomina:song:v1`.

   | Operación | Comportamiento |
   |---|---|
   | `setTitle(t)` | actualiza el título de la canción |
   | `addStanza()` | agrega una `StanzaVm` vacía con `crypto.randomUUID()` |
   | `removeStanza(id)` | la quita |
   | `setStanzaTitle(id, t)` | actualiza `titleText` |
   | `setStanzaText(id, raw)` | **el corazón**: guarda `rawText`, llama `parseStanzaText`, reconcilia con `reconcileVerses(node.verses, nuevos)` y guarda el resultado. Captura `LyricsParseError` y deja el mensaje en `error` |
   | `markVersesChanged()` | `update(s => ({ ...s }))` — nueva referencia para disparar el autoguardado tras un toggle |
   | `clear()` | resetea a estado vacío |
   | `loadFromLyrics(text)` | `parseLyrics` → `fromSongNode` → reemplaza el estado |
   | `toLyricsText()` | `toSongNode` → `printLyrics` |

   **Todas** las mutaciones producen una referencia nueva del objeto raíz. El autoguardado es un
   `effect()` que lee el signal y llama a `DraftStorage.write`. La restauración ocurre en el
   constructor.

**Verificación:** `npm test` en verde, `npm start` compila.

---

## BLOQUE 8 — Página `Editor` y limpieza del scaffold

- [ ] Completado

**Objetivo:** juntar todo y borrar el placeholder del CLI.

**Archivos:** `client/src/app/pages/editor/editor.ts|html|scss`, `client/src/app/app.routes.ts`,
`client/src/app/app.html`, `client/src/app/app.ts`, `client/src/app/app.spec.ts`

1. `editor.html`:
   ```html
   <mat-toolbar class="editor__bar">
     <mat-form-field appearance="outline" class="editor__title">
       <mat-label>Título de la canción</mat-label>
       <input matInput [value]="song().title" (input)="onTitle($any($event.target).value)">
     </mat-form-field>

     <button mat-icon-button aria-label="Limpiar" (click)="onClear()">
       <mat-icon>delete_sweep</mat-icon>
     </button>
     <button mat-icon-button aria-label="Cargar .lyrics" (click)="fileInput.click()">
       <mat-icon>folder_open</mat-icon>
     </button>
     <button mat-icon-button aria-label="Guardar .lyrics" (click)="onSave()">
       <mat-icon>save</mat-icon>
     </button>
     <input #fileInput type="file" accept=".lyrics,text/plain" hidden (change)="onLoad($event)">
   </mat-toolbar>

   @for (stanza of song().stanzas; track stanza.id) {
     <app-stanza-card
       [stanza]="stanza"
       (titleChanged)="store.setStanzaTitle(stanza.id, $event)"
       (textChanged)="store.setStanzaText(stanza.id, $event)"
       (versesChanged)="store.markVersesChanged()"
       (removed)="store.removeStanza(stanza.id)" />
   }

   <button mat-fab extended (click)="store.addStanza()">
     <mat-icon>add</mat-icon> Agregar estrofa
   </button>
   ```
   - Los iconos ya están disponibles: `index.html` carga Material Icons desde el CDN.
   - En viewport angosto la toolbar debe envolver (`flex-wrap: wrap`) o los botones se salen.
   - `onClear()` debe pedir confirmación — borra todo el trabajo.
   - `onLoad`: `await file.text()` → `store.loadFromLyrics(text)` → `input.value = ''` (para poder
     recargar el mismo archivo).
   - `accept=".lyrics,text/plain"`: con solo `.lyrics` muchos gestores de archivos de Android grisean
     todo.
   - Nombre por defecto al guardar: slug del título, o `cancion.lyrics`.

2. `app.routes.ts` — **lazy desde el principio**, para que agregar la próxima página sea una línea:
   ```ts
   export const routes: Routes = [
     { path: '', pathMatch: 'full', redirectTo: 'editor' },
     {
       path: 'editor',
       title: 'Editor',
       loadComponent: () => import('./pages/editor/editor').then(m => m.Editor),
     },
     { path: '**', redirectTo: 'editor' },
   ];
   ```

3. `app.html`: borrar **todo** el placeholder del CLI (el `<style>` inline, el logo, los links), dejar
   solo `<router-outlet />`. Aquí entrará más adelante un componente shell con navegación global
   cuando exista una segunda página; **no lo construyas ahora**.

4. `app.ts`: quitar el signal `title`.

5. `app.spec.ts`: **hay que reescribirlo.** Su segundo test afirma sobre el `<h1>Hello, client</h1>`
   del placeholder y va a fallar. Déjalo solo con el "should create", manteniendo el idiom zoneless
   `await fixture.whenStable()` (no `detectChanges()`). Ojo: TestBed corre con
   `errorOnUnknownElements: true`, así que los `imports` deben estar completos.

**Verificación:** `npm test` en verde y la app carga en el navegador sin errores de consola.

---

## BLOQUE 9 — Verificación end-to-end

- [ ] Completado

```
cd lyrics-language && npm run build && npm test
cd client && npm test && npm start
```

En el navegador, probando en ventana ancha y angosta (DevTools en modo dispositivo):

1. **Escritura.** Agregar estrofa, escribir `trifuerza trifuerza` → aparecen los versos silabeados con
   el `_` clickeable dentro de `fu_er`. El textarea crece al agregar líneas y no tiene manija de
   resize.
2. **Toggle.** Clickear el `_` → cambia a `+` y al estilo de activo. Clickear el hueco entre dos
   palabras → aparece `&`.
3. **Preservación (el test crítico).** Con varias alteraciones activadas, editar **otra** línea del
   textarea → las alteraciones de las líneas que no tocaste siguen activas. Agregar una línea al
   principio → igual.
4. **Guardar.** Botón guardar → se descarga un `.lyrics`. Abrirlo: debe verse como el fixture
   (`tri-fu_er-za`, `&` donde activaste sinalefa) y **debe re-parsear sin error** — verifícalo
   abriéndolo con la extensión de VSCode del repo, que ya valida el formato.
5. **Cargar.** Botón cargar con `lyrics-language/fixtures/delirio-en-hyrule.lyrics` → dos cards ("" y
   "Coro Cósmico"), título "Delirio en Hyrule", y las alteraciones del archivo ya activas donde
   corresponde. Cargar y guardar sin tocar nada debe producir un archivo equivalente.
6. **Tema.** Cambiar el tema del sistema a oscuro → la app cambia sin recargar.
7. **Layout.** Ventana < 900 px: textbox y textarea a todo el ancho, versos debajo. Ventana ≥ 900 px:
   inputs en el tercio izquierdo, versos en los dos tercios derechos.
8. **Persistencia.** Escribir algo, F5 → el trabajo sigue ahí, con las alteraciones intactas.
9. **Errores.** Escribir algo que reviente el parser → la card muestra el mensaje del
   `LyricsParseError` en lugar de dejar la app en blanco.
10. **Rutas.** `/` redirige a `/editor`; `/loquesea` también. En DevTools → Network se ve que el chunk
    del editor se carga aparte del bundle inicial.

---

## Trampas conocidas (consúltalas si algo se comporta raro)

1. **No re-parsear el `rawText` al importar un `.lyrics`.** Destruiría las alteraciones del autor. El
   `node` viene de `parseLyrics` y se conserva; el `rawText` se *deriva* de él, no al revés.
2. **No realimentar el textarea desde el AST mientras el usuario escribe.** `tokenizePlainLyrics`
   descarta puntuación y dígitos; le borrarías las comas en vivo.
3. **`computed` no ve las mutaciones de `marker.active`.** Usa `linkedSignal` + `set()` explícito.
4. **`mat.theme-overrides()` traga los typos en silencio.** Si un color no se aplica, sospecha del
   nombre del token antes que de la cascada.
5. **Hay que reconstruir `lyrics-language` (`npm run build`) tras cada cambio en la librería** para
   que el cliente lo vea — el paquete expone `dist/`, no `src/`.
6. **La aritmética de offset del `internalMarker` es relativa a la sílaba, no absoluta.** Es lo único
   que se copia del printer y donde un error se ve "casi bien".
7. **Nunca importes de `pages/` dentro de `shared/`.** Es la regla que mantiene barata la próxima
   página. Si aparece la tentación, el archivo está en la carpeta equivocada.
