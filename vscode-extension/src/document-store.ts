import * as vscode from 'vscode';
import { parseLyrics, LyricsParseError, type SongNode } from '@codex-obscura-nomina/lyrics-language';

export interface ParseResult {
    version: number;
    song: SongNode | null;
    error: LyricsParseError | null;
}

const cache = new Map<string, ParseResult>();

/** Parses `document` on demand, reusing the cached result while its `version` hasn't changed. */
export function getParsed(document: vscode.TextDocument): ParseResult {
    const key = document.uri.toString();
    const cached = cache.get(key);
    if (cached !== undefined && cached.version === document.version) {
        return cached;
    }

    let result: ParseResult;
    try {
        result = { version: document.version, song: parseLyrics(document.getText()), error: null };
    } catch (err) {
        if (!(err instanceof LyricsParseError)) {
            throw err;
        }
        result = { version: document.version, song: null, error: err };
    }
    cache.set(key, result);
    return result;
}

export function invalidate(uri: vscode.Uri): void {
    cache.delete(uri.toString());
}
