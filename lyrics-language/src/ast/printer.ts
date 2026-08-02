import type {
    AlterableMarker,
    CommentNode,
    SongNode,
    StanzaNode,
    SyllableNode,
    VerseNode,
    WordNode
} from './interfaces/index.js';

interface CommentBuckets {
    leading: CommentNode[];
    trailing: CommentNode | null;
    dangling: CommentNode[];
}

/**
 * Splits a node's `comments` into leading (own line, before the node),
 * trailing (same line as the node's own content), and dangling (own line,
 * after the node — only possible for the last verse/stanza/song in the
 * file, see the pending-comment flush at the end of `parseSong` in
 * `parser.ts`). `anchorLine` is the line the node's own content ends on
 * (a title's line, or a verse's last word's line); `null` when the node has
 * no title of its own (song/stanza without one), in which case every
 * comment is necessarily leading.
 */
function classifyComments(comments: CommentNode[], anchorLine: number | null): CommentBuckets {
    if (anchorLine === null) {
        return { leading: comments, trailing: null, dangling: [] };
    }
    return {
        leading: comments.filter(c => c.range.start.line < anchorLine),
        trailing: comments.find(c => c.range.start.line === anchorLine) ?? null,
        dangling: comments.filter(c => c.range.start.line > anchorLine)
    };
}

function printCommentLine(comment: CommentNode): string {
    return `// ${comment.text}`;
}

function withTrailingComment(line: string, trailing: CommentNode | null): string {
    return trailing !== null ? `${line} // ${trailing.text}` : line;
}

/** Pure kind+active → DSL symbol mapping, shared by internalMarker/boundary/trailingJoin. */
function markerSymbol(marker: AlterableMarker): string {
    switch (marker.kind) {
        case 'diaeresis': return marker.active ? '+' : '_';
        case 'synaeresis': return marker.active ? '%' : '/';
        case 'sinalefa': return marker.active ? '&' : ' ';
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

function printWord(word: WordNode): string {
    const syllables = word.syllables.map(printSyllable).join('');
    const join = word.trailingJoin !== null ? markerSymbol(word.trailingJoin) : '';
    return syllables + join;
}

function printVerse(verse: VerseNode): string[] {
    const anchorLine = verse.range.end.line;
    const { leading, trailing, dangling } = classifyComments(verse.comments, anchorLine);
    const content = verse.words.map(printWord).join('');

    return [
        ...leading.map(printCommentLine),
        withTrailingComment(content, trailing),
        ...dangling.map(printCommentLine)
    ];
}

function printStanza(stanza: StanzaNode): string[] {
    const anchorLine = stanza.title !== null ? stanza.title.range.end.line : null;
    const { leading, trailing, dangling } = classifyComments(stanza.comments, anchorLine);

    const lines: string[] = leading.map(printCommentLine);
    if (stanza.title !== null) {
        lines.push(withTrailingComment(`## ${stanza.title.text}`, trailing));
    }
    for (const verse of stanza.verses) {
        lines.push(...printVerse(verse));
    }
    lines.push(...dangling.map(printCommentLine));
    return lines;
}

function printSong(song: SongNode): string[] {
    const anchorLine = song.title !== null ? song.title.range.end.line : null;
    const { leading, trailing, dangling } = classifyComments(song.comments, anchorLine);

    const lines: string[] = leading.map(printCommentLine);
    if (song.title !== null) {
        lines.push(withTrailingComment(`# ${song.title.text}`, trailing));
    }

    song.stanzas.forEach((stanza, i) => {
        if (i > 0) {
            lines.push('');
        }
        lines.push(...printStanza(stanza));
    });

    lines.push(...dangling.map(printCommentLine));
    return lines;
}

/** Serializes a {@link SongNode} back into a `.lyrics` source string, re-parseable with `parseLyrics`. */
export function printLyrics(song: SongNode): string {
    const lines = printSong(song);
    return lines.length > 0 ? lines.join('\n') + '\n' : '';
}
