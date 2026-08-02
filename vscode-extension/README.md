# Codex Obscura Nomina — Lyrics

VSCode language support for `.lyrics` files: syntax highlighting, hover, outline, completion, diagnostics, formatting, and one-click editing of the DSL's alterable markers. Built directly on top of [`@codex-obscura-nomina/lyrics-language`](../lyrics-language) — no Language Server, just a single extension that parses in the extension host and registers VSCode's providers directly.

## The `.lyrics` format

A quick reference — see the [lyrics-language README](../lyrics-language/README.md) for the full spec.

| Symbol | Meaning |
|---|---|
| ` ` (space) | Word separator; sinalefa **off** between the two words. |
| `-` | Syllable separator. |
| `&` | Sinalefa **on** (fuses two words, e.g. `a&otro`). |
| `+` / `_` | Diéresis **on** / **off** (splits vs. keeps a vowel pair as one syllable). |
| `%` / `/` | Sinéresis **on** / **off** (keeps vs. splits a vowel pair). |
| `#` | Song title — first line of the file only. |
| `##` (or more) | Stanza title — first line of its stanza. |
| `//` | Comment to end of line. |
| `\n\n` | End of stanza. |

## Features

**Syntax highlighting** — a TextMate grammar scopes every DSL symbol, plus titles and comments. Since most color themes don't define rules for these scopes, the extension also injects a default color rule per symbol into your `editor.tokenColorCustomizations` on activation (only the scopes you haven't already customized yourself — see [Default colors](#default-colors) below).

**Hover** — hovering a syllable, title, comment, or alterable marker shows what it is. On a marker (`+`/`_`/`%`/`/`/`&`/space), the hover also offers a "Cambiar a `X`" link that flips it to its paired state in one click.

**Outline** — the document symbol tree mirrors the song structure: song → stanzas → verses, with breadcrumbs and Ctrl+Shift+O navigation.

**Completion** — context-aware suggestions for `#`/`##` titles, `//` comments, and the alterable-pair symbols between two vowels. Between two vowels it always offers all four symbols (`+`/`_`/`%`/`/`) together — the extension has no phonetic engine of its own, so it never guesses which one is "correct."

**Diagnostics** — a parse error (invalid syllable, unmatched marker, more than one title, etc.) is underlined at its exact position and listed in the Problems panel, instead of only being visible on hover.

**Formatting** (`Shift+Alt+F`) — canonicalizes the file: stanza markers collapse to exactly `##`, comments become `// text`, and runs of blank lines between stanzas collapse to exactly one.

**Toggle a marker** — click the link in a marker's hover, run *Lyrics: Alternar alteración* from the Command Palette, use `Alt+T`, or trigger the `Ctrl+.` code action with the cursor on the symbol. All four alterable pairs are supported: `+`↔`_`, `%`↔`/`, `&`↔space. This never crosses between diéresis and sinéresis — they're different phenomena in the DSL, so a `_` only ever offers `+`, never `%`.

**Annotate plain text** — run *Lyrics: Anotar texto plano* to turn unannotated Spanish lyrics into an annotated `.lyrics` document: syllable boundaries and each vowel pair's natural diphthong/hiato state are computed automatically. Runs on the current selection, or the whole document if nothing is selected. If the target already looks like valid `.lyrics`, you're asked to confirm before re-annotating, since that would discard any diéresis/sinéresis you placed by hand.

## Commands

| Command | Title | Default keybinding |
|---|---|---|
| `lyrics.annotate` | Lyrics: Anotar texto plano | — |
| `lyrics.toggleMarker` | Lyrics: Alternar alteración | `Alt+T` |

Both only appear in the Command Palette while a `.lyrics` file is focused.

## Default colors

Since a TextMate grammar only assigns *scopes* — the color always comes from the active theme, and most themes never define a rule for an unfamiliar scope — this extension writes a small set of default colors for its scopes into your **global** `editor.tokenColorCustomizations` the first time it activates. It only adds scopes you haven't already customized yourself; any rule you've already set for one of these scopes (or added afterward) is left untouched. Defaults: dark gray for the syllable separator, green for activated markers (`&`/`+`/`%`), blue for deactivated ones (`_`/`/`).

This is a deliberate, non-marketplace-friendly choice made for personal use with a single custom DSL — feel free to delete the injected rules from your settings if you'd rather theme it yourself.

## Requirements

- VSCode `^1.85.0`.
- [`@codex-obscura-nomina/lyrics-language`](../lyrics-language), linked as a local workspace dependency — no separate install needed inside this monorepo.

## Development

```bash
npm install
npm run build   # bundles src/extension.ts -> dist/extension.cjs via esbuild
npm run watch   # same, in watch mode
npm test        # node --test over src/**/*.test.ts
```

Press `F5` (see `.vscode/launch.json`) to open an Extension Development Host with the extension loaded, and open a `.lyrics` file to try it out.

### Layout

- `document-store.ts` — parses on demand, caches by `document.version`.
- `position.ts` — converts between VSCode's 0-indexed `Position` and lyrics-language's 1-indexed one.
- `markers.ts` — pure logic for what a marker toggle produces; no `vscode` import.
- `diagnostics.ts` — publishes `LyricsParseError` as editor diagnostics.
- `providers/` — hover, outline, completion (+ its pure `completion-context.ts`), formatting, code actions.
- `commands/` — `toggleMarker` and `annotate`.
- `token-colors.ts` + `activation.ts` — default color injection.
- `syntaxes/lyrics.tmLanguage.json` — the TextMate grammar.

Most of the logic that doesn't need the `vscode` API (`markers.ts`, `completion-context.ts`, `token-colors.ts`) is kept free of that import specifically so it can be unit-tested with plain `node --test`, without mocking the extension host.
