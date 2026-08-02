import type { VerseNode } from '@codex-obscura-nomina/lyrics-language';
import { parsePlainLyrics } from '@codex-obscura-nomina/lyrics-language';

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
