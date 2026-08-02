import type { VerseNode } from '@codex-obscura-nomina/lyrics-language';
import { verseKey } from './verse-key';

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
