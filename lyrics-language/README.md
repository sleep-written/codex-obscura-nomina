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
| ` ` (space) | Word separator across which **no sinalefa is possible** (no vowel meets a vowel), so there is nothing to alter — the between-words counterpart of `-`. |
| `-` | Syllable separator that can never be fused. |
| `&` | Sinalefa **on** (replaces the space between the two words it fuses, e.g. `a&otro`). |
| `\|` | Sinalefa **off**: the two words *could* fuse, but don't (e.g. `a\|otro`). Also replaces the space. |
| `+` | Diéresis **on** (forces a natural diptongo apart into two syllables). |
| `_` | Diéresis **off** (an explicit, no-op marker — see below). |
| `%` | Sinéresis **on** (forces a natural hiato together into one syllable). |
| `/` | Sinéresis **off** (explicit no-op marker). |
| `#` | Song title. Only valid as the first line of the file, like a Markdown H1. |
| `##` (or more `#`) | Stanza title. Must be the first line of its stanza, like a Markdown H2. All counts of 2+ collapse to the same "stanza title" meaning. |
| `:` | Separates a metadata key from its value on a header line (`albumYear: 1999`). Only meaningful there — a `:` inside a verse is a parse error, as it always was. |
| `//` | Comment to end of line. Can stand on its own line or trail after content (`a-ho-ra // note`). |
| `\n` | End of verse. |
| `\n\n` (2+ newlines) | End of stanza. A run of any length collapses to one boundary. |

**Diéresis/sinéresis marking is mandatory on every alterable vowel pair, not just on deviations from the natural pronunciation.** Every adjacent vowel pair inside a word — whether it's a natural diptongo or a natural hiato — must carry one of its two symbols explicitly, even when the result matches the natural state and nobody touched it. Example: *"trifuerza"* has the natural diptongo *"ue"*; it's written `tri-fu_er-za` (diéresis explicitly off) rather than `tri-fuer-za`. This is what lets a `.lyrics` file round-trip through the parser without re-running any phonetic analysis: the file is self-contained.

**Sinalefa follows the same rule.** A word boundary where a vowel sound meets a vowel sound must carry `&` or `|` explicitly; a plain space is reserved for boundaries where no sinalefa is possible at all. Without that distinction a space would mean two different things — "possible but off" and "impossible" — and nothing reading the file could tell them apart, so a tool would end up offering to fuse *"que me"*.

### Metadata

Both the song and each stanza can carry an optional block of `key: value` lines in their **header** — at the top of the file under the `#` title, and at the top of a stanza under its `##` title. Every key is optional; the block itself can be absent entirely.

```
# Torquemada
artist: Avalanch
album: Llanto De Un Héroe
albumArtist: Avalanch
albumYear: 1999
trackNumber: 2

## Verso
desiredLength: 11
La|i-gle-si_a|en sus ma-nos de-le-gó
```

| Key | Scope | Value |
|---|---|---|
| `artist` | song | text |
| `album` | song | text |
| `albumArtist` | song | text |
| `albumYear` | song | whole number |
| `trackNumber` | song | whole number |
| `desiredLength` | stanza | whole number — the note count each verse of the stanza is aiming for |

The key set is **closed and validated**: an unrecognized key, a repeated one, an empty value, or a non-numeric value on a numeric key is a `LyricsParseError` with the offending line/column. That's what lets an editor integration surface a bad header as a squiggle, via the same `LyricsParseError` path as any other structural violation.

The two key sets are deliberately disjoint, so a key alone says which header it belongs to — an untitled first stanza's `desiredLength` is never mistaken for song metadata. A metadata line outside a header (below the first stanza for a song key, below the stanza's first verse for a stanza key) is also an error, which is what keeps a `:` inside an ordinary lyric line unambiguous.

A value is kept verbatim: punctuation, digits and further colons all survive (`album: Vol. II: 2 Héroes & 1 Cucco`). Comments interleave with metadata lines exactly as they do with verses, and print back where they were written.

`desiredLength` is the author's stated intent and nothing more — this package never validates a verse against it. Compare it yourself against `verseMetrics(verse).count`.

### Example

```
# Delirio en Hyrule
Un cuc-co|e-nor-me|in-cu-bó la tri-fu_er-za
Ga-non-dorf a/ho-ra te-je bu-fan-das de Na-vi // nombres propios sin acentuar
Link na-da|en so-pa del Tem-plo del Ti_em-po
y Zel-da ven-de pa-ra-gu_as en Ge-ru-do

// segunda estrofa: el coro
## Coro Cósmico
Tri-fu_er-za tri-fu_er-za dón-de te|es-con-dis-te
De-ba-jo del som-bre-ro de|un De-ku tris-te
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

- **`parsePlainLyrics(source: string): SongNode`** — parses unannotated Spanish text: no syllable separators, no diéresis/sinéresis/sinalefa marks. Syllable boundaries and each vowel pair's natural diptongo/hiato state are computed automatically by a Spanish syllabification engine. `#`/`##` titles and `//` comments are still recognized literally; anything else unrecognized (punctuation, digits, a DSL symbol typed loose) is silently dropped. A word boundary becomes an alterable sinalefa (`|`) when a vowel sound meets a vowel sound across it — silent `h` doesn't block it, and a final or lone `y` counts as a vowel — and a plain space otherwise. Whether to *apply* the sinalefa is **never** inferred: that fusion is a musical/metrical choice, not a phonetic fact, so a plain-text import always starts with every boundary open. A `SongNode` from this path can still throw `LyricsParseError` for the same structural violations as `parseLyrics` (e.g. more than one song title).

- **`printLyrics(song: SongNode): string`** — serializes a `SongNode` back into annotated `.lyrics` text, re-parseable with `parseLyrics`. Canonicalizes stanza title markers to exactly `##` regardless of how many `#` the original had (that count isn't retained in the AST). An empty song prints to `''`, not a stray newline.

- **`printPlainLyrics(song: SongNode): string`** — serializes a `SongNode` into unannotated plain text, re-parseable with `parsePlainLyrics`. Titles, metadata and comments are preserved; every DSL symbol carried by words is lost by design — syllable separators, diéresis/sinéresis marks, and sinalefa (both `&` and `|` fall back to a plain space, since plain text has no "fused words" notation).

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
    | { kind: 'metadata'; entry: MetadataEntry; part: 'key' | 'value'; owner: 'song' | 'stanza' }
    | { kind: 'marker'; marker: AlterableMarker }
    | { kind: 'syllable'; syllable: SyllableNode; word: WordNode }
    | { kind: 'none' };
```

This is pure logic with no editor dependency — it's what powers the [vscode-extension](../vscode-extension)'s hover, completion, and outline providers. Note the package's `Position`/`Range` are **1-indexed** (matching `Token.line`/`Token.column`); an editor integration using 0-indexed positions must convert both ways at its boundary.

### Counting notes (metrics)

```ts
import { verseMetrics, stanzaMetrics, songMetrics } from '@codex-obscura-nomina/lyrics-language';

const { notes, boundaries, count, min, max } = verseMetrics(verse);
```

A **note** is one beat of the voice — *not* the same thing as a `SyllableNode`: a sinalefa fuses syllables from two different words into one note, and a diéresis splits one syllable into two. `verseMetrics` groups a verse into the notes it sings **today** and reports how far that count can be pushed without rewriting a single word:

- `notes: Note[]` — each with `text` and `parts: NotePart[]`. A note has more than one part only where a marker is currently fusing (`_`, `%`, `&`); `part.tie` is that marker, so a renderer can draw the fusion *inside* the note and make it clickable.
- `boundaries: NoteBoundary[]` — `boundaries[i]` sits between `notes[i]` and `notes[i + 1]`. `marker` is the alterable marker keeping them apart, or `null` when nothing there can change (a plain `-`, a plain space); `word` says whether the two notes belong to different words.
- `count` / `min` / `max` — notes today, notes with every alterable marker fused, notes with all of them split. `min === max` means the verse's length is fixed.

`stanzaMetrics(stanza)` and `songMetrics(song)` return the per-child metrics plus the extremes across them (`0`/`0` when empty) — the natural scale for plotting a stanza's verses against each other.

`markerMerges(marker: AlterableMarker): boolean` is also exported: whether a marker, as written, keeps both sides in the same note. Unlike `active`, it means the same thing for all three kinds.

## The AST

```
SongNode
├── title: TitledText | null       // from `#Title`
├── metadata: SongMetadata         // artist/album/albumArtist/albumYear/trackNumber
├── comments: CommentNode[]
└── stanzas: StanzaNode[]
    ├── title: TitledText | null   // from `##Title`
    ├── metadata: StanzaMetadata   // desiredLength
    ├── comments: CommentNode[]
    └── verses: VerseNode[]
        ├── comments: CommentNode[]
        └── words: WordNode[]
            ├── trailingJoin: AlterableMarker | null   // `&`/`|` to the NEXT word; null on a plain space
            └── syllables: SyllableNode[]
                ├── text: string                        // graphemes only, no symbols
                ├── internalMarker: AlterableMarker | null  // `_`/`%`, lives inside this syllable
                └── boundary: 'separator' | AlterableMarker | null  // `-`, or `+`/`/`, to the NEXT syllable
```

Every node carries a `range: Range` (1-indexed `{ start, end }`, `end` exclusive), including each `AlterableMarker`, so tooling can hover/highlight the individual `+`/`_`/`%`/`/`/`&`/`|` symbol. `title` is a `TitledText` (`{ text, range }`); `comments` are `CommentNode[]` (`{ text, range }`).

**`SongMetadata` / `StanzaMetadata`** are records whose every field is a `MetadataEntry | null` — `null` meaning the line was absent. An entry is `{ key, value, keyRange, valueRange, range }`, with `value: string` for a text key and `value: number` for a numeric one, and the key/value spans split so tooling can hover either half. `SONG_METADATA_SPEC`/`STANZA_METADATA_SPEC` (the key → value-kind maps), `emptySongMetadata()`/`emptyStanzaMetadata()` (for building a node from scratch) and `metadataSlots(metadata)` (a key → entry view, for walking a header generically) are exported alongside them.

The tree is nested by syllable rather than a flat token stream, specifically so a consumer can iterate and render it directly without having to interpret which DSL symbol produced which node — see [vscode-extension](../vscode-extension) and the syllable-card style frontend this package was built for.

**`AlterableMarker`** (`{ kind: 'diaeresis' | 'synaeresis' | 'sinalefa', active: boolean, range: Range }`) is the shared shape for every alterable symbol: `active` reflects which of the pair (`+`/`_`, `%`//`, `&`/`|`) was actually used. Note that `active` means "fuses" for sinéresis and sinalefa but "splits" for diéresis — it tracks which symbol was written, not one shared meaning. `markerMerges(marker)` (see below) is the flag with a single meaning.

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
- `LyricsToken` / `LyricsTokenType` — the token type this package's tokenizers produce (`Token<LyricsTokenType>`) and its type tag union (`'text' | 'word-separator' | 'syllable-separator' | 'sinalefa-on' | 'sinalefa-off' | 'diaeresis-on' | 'diaeresis-off' | 'synaeresis-on' | 'synaeresis-off' | 'metadata-separator' | 'song-title-marker' | 'stanza-title-marker' | 'comment' | 'verse-end' | 'stanza-end' | 'unknown'`).
- `Token<T>` / `TokenFactory` / `Tokenizer<T>` / `Character` — the generic, DSL-agnostic tokenizer engine `lyricsTokenizer` is built on.

The Spanish syllabification engine (`src/phonetics/`) that powers `parsePlainLyrics` is intentionally **not** exported — it's an internal detail of the plain-text import path, not a general-purpose syllabifier.

## Development

```bash
npm test         # runs the test suite (node --test)
npm run build    # emits dist/ (JS + .d.ts)
npm run e2e      # parses fixtures/delirio-en-hyrule.txt and dumps the resulting AST
```
