import { SONG_METADATA_SPEC, STANZA_METADATA_SPEC, metadataSlots } from './interfaces/index.js';
import type {
    AlterableMarker,
    CommentNode,
    MetadataEntry,
    MetadataValueKind,
    SongMetadata,
    SongNode,
    StanzaMetadata,
    StanzaNode,
    SyllableNode,
    VerseNode,
    WordNode
} from './interfaces/index.js';

function printCommentLine(comment: CommentNode): string {
    return `// ${comment.text}`;
}

function withTrailingComment(line: string, trailing: CommentNode | null): string {
    return trailing !== null ? `${line} // ${trailing.text}` : line;
}

/** One rendered source line of a node's own content, tagged with the line it sat on. */
interface AnchoredLine {
    line: number;
    text: string;
}

/**
 * Prints the lines a node's own content occupies (a title, its metadata
 * entries, or a verse's words) with the node's `comments` put back where they
 * were written: a comment from an earlier line prints above the line it led,
 * one from the same line trails it. Whatever is left over sat below every
 * anchor, so it's handed back for the caller to print after the node's body —
 * that's the "dangling" case, only reachable on the last verse/stanza/song in
 * the file (see the pending-comment flush at the end of `parseSong`).
 *
 * With no anchors at all — an untitled, metadata-less song or stanza — there
 * is nothing to compare a line number against, so every comment is leading.
 */
function printAnchored(
    anchors: AnchoredLine[],
    comments: CommentNode[]
): { lines: string[]; below: CommentNode[] } {
    if (anchors.length === 0) {
        return { lines: comments.map(printCommentLine), below: [] };
    }

    const lines: string[] = [];
    const used = new Set<CommentNode>();

    for (const anchor of anchors) {
        for (const comment of comments) {
            if (!used.has(comment) && comment.range.start.line < anchor.line) {
                lines.push(printCommentLine(comment));
                used.add(comment);
            }
        }
        const trailing = comments.find(c => !used.has(c) && c.range.start.line === anchor.line) ?? null;
        if (trailing !== null) {
            used.add(trailing);
        }
        lines.push(withTrailingComment(anchor.text, trailing));
    }

    return { lines, below: comments.filter(c => !used.has(c)) };
}

/**
 * Renders a header's metadata record as `key: value` lines, in source order.
 * The AST stores entries as named fields, so the original order has to be
 * recovered from their ranges; ties (every entry synthesized by a consumer
 * shares one range) fall back to the spec's own key order, since `sort` is
 * stable.
 */
function metadataAnchors(
    metadata: SongMetadata | StanzaMetadata,
    spec: Record<string, MetadataValueKind>
): AnchoredLine[] {
    const slots = metadataSlots(metadata);
    return Object.keys(spec)
        .map(key => slots[key] ?? null)
        .filter((entry): entry is MetadataEntry => entry !== null)
        .sort((a, b) => a.range.start.line - b.range.start.line)
        .map(entry => ({ line: entry.range.end.line, text: `${entry.key}: ${entry.value}` }));
}

/** Pure kind+active → DSL symbol mapping, shared by internalMarker/boundary/trailingJoin. */
function markerSymbol(marker: AlterableMarker): string {
    switch (marker.kind) {
        case 'diaeresis': return marker.active ? '+' : '_';
        case 'synaeresis': return marker.active ? '%' : '/';
        case 'sinalefa': return marker.active ? '&' : '|';
    }
}

/**
 * Re-inserts an internal marker's symbol into a syllable's already-merged
 * `text`. `text` never carries the symbol (see `SyllableNode.text`), so the
 * insertion point is derived from `range`: the marker's column offset from
 * the syllable's own start column equals the number of text graphemes that
 * precede it, since every source column advances by exactly one character
 * and the marker occupies its own column outside of `text`.
 */
function spliceInternalMarker(text: string, syllableStartColumn: number, marker: AlterableMarker): string {
    const offset = marker.range.start.column - syllableStartColumn;
    return text.slice(0, offset) + markerSymbol(marker) + text.slice(offset);
}

function printSyllable(syllable: SyllableNode): string {
    const text = syllable.internalMarker !== null
        ? spliceInternalMarker(syllable.text, syllable.range.start.column, syllable.internalMarker)
        : syllable.text;

    if (syllable.boundary === 'separator') {
        return text + '-';
    }
    if (syllable.boundary !== null) {
        return text + markerSymbol(syllable.boundary);
    }
    return text;
}

/**
 * Renders one word: its own text, plus the boundary to the NEXT word (empty
 * on the verse's last word — hence the `isLast` flag, since a `null`
 * `trailingJoin` also means a non-alterable boundary, which still needs its
 * space printed). The only thing that differs between `printLyrics` and
 * `printPlainLyrics`.
 */
interface WordPrinter {
    text: (word: WordNode) => string;
    join: (trailingJoin: AlterableMarker | null, isLast: boolean) => string;
}

const annotatedWordPrinter: WordPrinter = {
    text: word => word.syllables.map(printSyllable).join(''),
    join: (trailingJoin, isLast) => {
        if (isLast) return '';
        return trailingJoin !== null ? markerSymbol(trailingJoin) : ' ';
    }
};

/**
 * Renders words as unannotated text: syllable text is concatenated with no
 * DSL symbols (`internalMarker`/`boundary` dropped), and every word boundary
 * — including an active sinalefa — falls back to a plain space, since plain
 * text has no way to express a fused word boundary.
 */
const plainWordPrinter: WordPrinter = {
    text: word => word.syllables.map(s => s.text).join(''),
    join: (_trailingJoin, isLast) => isLast ? '' : ' '
};

function printVerse(verse: VerseNode, printWord: WordPrinter): string[] {
    const content = verse.words
        .map((w, i) => printWord.text(w) + printWord.join(w.trailingJoin, i === verse.words.length - 1))
        .join('');

    const { lines, below } = printAnchored(
        [{ line: verse.range.end.line, text: content }],
        verse.comments
    );
    return [...lines, ...below.map(printCommentLine)];
}

function printStanza(stanza: StanzaNode, printWord: WordPrinter): string[] {
    const anchors: AnchoredLine[] = [];
    if (stanza.title !== null) {
        anchors.push({ line: stanza.title.range.end.line, text: `## ${stanza.title.text}` });
    }
    anchors.push(...metadataAnchors(stanza.metadata, STANZA_METADATA_SPEC));

    const { lines, below } = printAnchored(anchors, stanza.comments);
    for (const verse of stanza.verses) {
        lines.push(...printVerse(verse, printWord));
    }
    lines.push(...below.map(printCommentLine));
    return lines;
}

function printSong(song: SongNode, printWord: WordPrinter): string[] {
    const anchors: AnchoredLine[] = [];
    if (song.title !== null) {
        anchors.push({ line: song.title.range.end.line, text: `# ${song.title.text}` });
    }
    anchors.push(...metadataAnchors(song.metadata, SONG_METADATA_SPEC));

    const { lines, below } = printAnchored(anchors, song.comments);

    song.stanzas.forEach((stanza, i) => {
        if (i > 0) {
            lines.push('');
        }
        lines.push(...printStanza(stanza, printWord));
    });

    lines.push(...below.map(printCommentLine));
    return lines;
}

function joinLines(lines: string[]): string {
    return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

/** Serializes a {@link SongNode} back into a `.lyrics` source string, re-parseable with `parseLyrics`. */
export function printLyrics(song: SongNode): string {
    return joinLines(printSong(song, annotatedWordPrinter));
}

/**
 * Serializes a {@link SongNode} into unannotated Spanish lyrics text,
 * re-parseable with `parsePlainLyrics`. Titles, metadata and comments are
 * preserved, but every DSL symbol carried by words is lost: syllable separators,
 * diéresis/sinéresis marks, and sinalefa (rendered as a plain space, since
 * plain text has no "fused words" notation).
 */
export function printPlainLyrics(song: SongNode): string {
    return joinLines(printSong(song, plainWordPrinter));
}
