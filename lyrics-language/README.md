# @codex-obscura-nomina/lyrics-language

A parser/printer toolkit for writing Spanish song lyrics with explicit, per-word control over the metrical phenomena that affect syllable count: **sinalefa** (vowel fusion across word boundaries), **diéresis** (forcing a hiato open) and **sinéresis** (forcing a diptongo closed).

Nothing is inferred silently. Either you mark a phenomenon explicitly with its DSL symbol, or it's off. The one exception is the `parsePlainLyrics` entry point, which computes natural Spanish syllabification for unannotated text so you don't have to write the DSL by hand.

## Install

```bash
npm install @codex-obscura-nomina/lyrics-language
```

## The `.lyrics` format

A `.lyrics` file is plain text with a small set of symbols layered on top of normal Spanish words:

| Symbol | Meaning |
|---|---|
| ` ` (space) | Word separator. Also means sinalefa is **off** between the two words — there's no separate "off" symbol, the space itself is the default state. |
| `-` | Syllable separator. |
| `&` | Sinalefa **on** (replaces the space between the two words it fuses, e.g. `a&otro`). |
| `+` | Diéresis **on** (forces a natural diptongo apart into two syllables). |
| `_` | Diéresis **off** (an explicit, no-op marker — see below). |
| `%` | Sinéresis **on** (forces a natural hiato together into one syllable). |
| `/` | Sinéresis **off** (explicit no-op marker). |
| `#` | Song title. Only valid as the first line of the file, like a Markdown H1. |
| `##` (or more `#`) | Stanza title. Must be the first line of its stanza, like a Markdown H2. All counts of 2+ collapse to the same "stanza title" meaning. |
| `//` | Comment to end of line. Can stand on its own line or trail after content (`a-ho-ra // note`). |
| `\n` | End of verse. |
| `\n\n` (2+ newlines) | End of stanza. A run of any length collapses to one boundary. |

**Diéresis/sinéresis marking is mandatory on every alterable vowel pair, not just on deviations from the natural pronunciation.** Every adjacent vowel pair inside a word — whether it's a natural diptongo or a natural hiato — must carry one of its two symbols explicitly, even when the result matches the natural state and nobody touched it. Example: *"trifuerza"* has the natural diptongo *"ue"*; it's written `tri-fu_er-za` (diéresis explicitly off) rather than `tri-fuer-za`. This is what lets a `.lyrics` file round-trip through the parser without re-running any phonetic analysis: the file is self-contained.

Sinalefa does **not** follow this rule — a word boundary has no natural state to compare against (it's either fused or not), so there's no "explicitly off" symbol; a plain space is enough.

### Example

```
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

The equivalent plain text (see `parsePlainLyrics` below):

```
# Delirio en Hyrule
Un cucco enorme incubó la trifuerza
Ganondorf ahora teje bufandas de Navi // nombres propios sin acentuar
Link nada en sopa del Templo del Tiempo
y Zelda vende paraguas en Gerudo

// segunda estrofa: el coro
## Coro Cósmico
Trifuerza trifuerza dónde te escondiste
Debajo del sombrero de un Deku triste
```

## Usage

There are four conversions between text and the AST (`SongNode`), covering both text formats in both directions:

```ts
import {
    parseLyrics, printLyrics,
    parsePlainLyrics, printPlainLyrics
} from '@codex-obscura-nomina/lyrics-language';

// Annotated .lyrics text <-> SongNode
const song = parseLyrics(source);
const lyricsText = printLyrics(song);

// Unannotated plain text <-> SongNode
const songFromPlain = parsePlainLyrics(plainText);
const plainText = printPlainLyrics(songFromPlain);
```

- **`parseLyrics(source: string): SongNode`** — tokenizes and parses an annotated `.lyrics` source. Throws `LyricsParseError` on a structural violation (an empty syllable/word, a diéresis/sinéresis marker not following a vowel, more than one song/stanza title, etc.). Never fails for phonetic reasons — it trusts every marker's `active` state as written, it doesn't evaluate whether it matches the "natural" pronunciation.

- **`parsePlainLyrics(source: string): SongNode`** — parses unannotated Spanish text: no syllable separators, no diéresis/sinéresis/sinalefa marks. Syllable boundaries and each vowel pair's natural diptongo/hiato state are computed automatically by a Spanish syllabification engine. `#`/`##` titles and `//` comments are still recognized literally; anything else unrecognized (punctuation, digits, a DSL symbol typed loose) is silently dropped. Sinalefa is **never** inferred between words — that fusion is a musical/metrical choice, not a phonetic fact, so a plain-text import always starts with every word boundary open; a `SongNode` from this path can still throw `LyricsParseError` for the same structural violations as `parseLyrics` (e.g. more than one song title).

- **`printLyrics(song: SongNode): string`** — serializes a `SongNode` back into annotated `.lyrics` text, re-parseable with `parseLyrics`. Canonicalizes stanza title markers to exactly `##` regardless of how many `#` the original had (that count isn't retained in the AST). An empty song prints to `''`, not a stray newline.

- **`printPlainLyrics(song: SongNode): string`** — serializes a `SongNode` into unannotated plain text, re-parseable with `parsePlainLyrics`. Titles and comments are preserved; every DSL symbol carried by words is lost by design — syllable separators, diéresis/sinéresis marks, and sinalefa (an active sinalefa falls back to a plain space, since plain text has no "fused words" notation).

### Inspecting a position (editor tooling)

```ts
import { locate, type Position } from '@codex-obscura-nomina/lyrics-language';

const pos: Position = { line: 3, column: 12 }; // 1-indexed
const result = locate(song, pos);
```

`locate(song, pos)` finds the most specific node containing a 1-indexed `Position` and returns a tagged union:

```ts
type LocateResult =
    | { kind: 'title'; text: string; range: Range; owner: 'song' | 'stanza' }
    | { kind: 'comment'; comment: CommentNode; owner: 'song' | 'stanza' | 'verse' }
    | { kind: 'marker'; marker: AlterableMarker }
    | { kind: 'syllable'; syllable: SyllableNode; word: WordNode }
    | { kind: 'none' };
```

This is pure logic with no editor dependency — it's what powers the [vscode-extension](../vscode-extension)'s hover, completion, and outline providers. Note the package's `Position`/`Range` are **1-indexed** (matching `Token.line`/`Token.column`); an editor integration using 0-indexed positions must convert both ways at its boundary.

## The AST

```
SongNode
├── title: TitledText | null       // from `#Title`
├── comments: CommentNode[]
└── stanzas: StanzaNode[]
    ├── title: TitledText | null   // from `##Title`
    ├── comments: CommentNode[]
    └── verses: VerseNode[]
        ├── comments: CommentNode[]
        └── words: WordNode[]
            ├── trailingJoin: AlterableMarker | null   // sinalefa to the NEXT word
            └── syllables: SyllableNode[]
                ├── text: string                        // graphemes only, no symbols
                ├── internalMarker: AlterableMarker | null  // `_`/`%`, lives inside this syllable
                └── boundary: 'separator' | AlterableMarker | null  // `-`, or `+`/`/`, to the NEXT syllable
```

Every node carries a `range: Range` (1-indexed `{ start, end }`, `end` exclusive), including each `AlterableMarker`, so tooling can hover/highlight the individual `+`/`_`/`%`/`/`/`&` symbol. `title` is a `TitledText` (`{ text, range }`); `comments` are `CommentNode[]` (`{ text, range }`).

The tree is nested by syllable rather than a flat token stream, specifically so a consumer can iterate and render it directly without having to interpret which DSL symbol produced which node — see [vscode-extension](../vscode-extension) and the syllable-card style frontend this package was built for.

**`AlterableMarker`** (`{ kind: 'diaeresis' | 'synaeresis' | 'sinalefa', active: boolean, range: Range }`) is the shared shape for every alterable symbol: `active` reflects which of the pair (`+`/`_`, `%`//`, `&`/space) was actually used.

## Error handling

```ts
import { parseLyrics, LyricsParseError } from '@codex-obscura-nomina/lyrics-language';

try {
    parseLyrics(source);
} catch (err) {
    if (err instanceof LyricsParseError) {
        console.error(`${err.message} at line ${err.line}, column ${err.column}`);
    }
}
```

## Lower-level exports

Most consumers only need the four conversions, `locate`, and the type exports above. The tokenizer layer underneath is also exported, for tooling that needs raw tokens instead of the AST:

- `lyricsTokenizer: Tokenizer<LyricsTokenType>` — tokenizes annotated `.lyrics` source via `lyricsTokenizer.tokenize(source)`.
- `tokenizePlainLyrics(source: string): LyricsToken[]` — the plain-text equivalent, producing the same token shape `parseSong` expects.
- `LyricsToken` / `LyricsTokenType` — the token type this package's tokenizers produce (`Token<LyricsTokenType>`) and its type tag union (`'text' | 'word-separator' | 'syllable-separator' | 'sinalefa' | 'diaeresis-on' | 'diaeresis-off' | 'synaeresis-on' | 'synaeresis-off' | 'song-title-marker' | 'stanza-title-marker' | 'comment' | 'verse-end' | 'stanza-end' | 'unknown'`).
- `Token<T>` / `TokenFactory` / `Tokenizer<T>` / `Character` — the generic, DSL-agnostic tokenizer engine `lyricsTokenizer` is built on.

The Spanish syllabification engine (`src/phonetics/`) that powers `parsePlainLyrics` is intentionally **not** exported — it's an internal detail of the plain-text import path, not a general-purpose syllabifier.

## Development

```bash
npm test         # runs the test suite (node --test)
npm run build    # emits dist/ (JS + .d.ts)
npm run e2e      # parses fixtures/delirio-en-hyrule.txt and dumps the resulting AST
```
