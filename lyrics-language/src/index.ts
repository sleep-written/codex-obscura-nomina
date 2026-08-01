import { readFile } from 'node:fs/promises';
import type { Token } from './tokenizer/interfaces/index.js';
import { lyricsTokenizer, type LyricsTokenType } from './tokenizer/lyrics-tokenizer.js';

export type { Token, TokenFactory } from './tokenizer/interfaces/index.js';
export { lyricsTokenizer, lyricsTokenFactories, type LyricsTokenType } from './tokenizer/lyrics-tokenizer.js';
export { Tokenizer } from './tokenizer/tokenizer.js';

/**
 * Reads a `.lyrics` file and tokenizes its content.
 *
 * @param path - Path to the `.lyrics` file to tokenize.
 */
export async function tokenizeLyricsFile(path: string): Promise<Token<LyricsTokenType>[]> {
    const content = await readFile(path, 'utf-8');
    return lyricsTokenizer.tokenize(content);
}
