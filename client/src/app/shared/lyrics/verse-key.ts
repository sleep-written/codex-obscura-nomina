import type { VerseNode } from '@codex-obscura-nomina/lyrics-language';

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
