import { parseLyrics, parsePlainLyrics, printPlainLyrics } from '@codex-obscura-nomina/lyrics-language';
import { reconcileVerses } from './reconcile-verses';

const FIXTURE = `// fixture de prueba para el tokenizer y el parser de AST
# Delirio en Hyrule
Un cuc-co&e-nor-me in-cu-bó la tri-fu_er-za
Ga-non-dorf a/ho-ra te-je bu-fan-das de Na-vi // nombres propios sin acentuar
Link na-da&en so-pa del Tem-plo del Ti_em-po
y Zel-da ven-de pa-ra-gu_as en Ge-ru-do

// segunda estrofa: el coro
## Coro Cósmico
Tri-fu_er-za tri-fu_er-za dón-de te&es-con-dis-te
De-ba-jo del som-bre-ro de&un De-ku tris-te
`;

describe('reconcileVerses', () => {
  it('preserves identity for verses untouched by an edit', () => {
    const previous = parsePlainLyrics('gato\nperro\nloro\n').stanzas[0].verses;
    const next = parsePlainLyrics('gato\ncerdo\nloro\n').stanzas[0].verses;
    const reconciled = reconcileVerses(previous, next);

    expect(reconciled[0]).toBe(previous[0]);
    expect(reconciled[1]).toBe(next[1]);
    expect(reconciled[2]).toBe(previous[2]);
  });

  it('preserves identity for all verses after inserting a line at the start', () => {
    const previous = parsePlainLyrics('perro\nloro\n').stanzas[0].verses;
    const next = parsePlainLyrics('gato\nperro\nloro\n').stanzas[0].verses;
    const reconciled = reconcileVerses(previous, next);

    expect(reconciled[0]).toBe(next[0]);
    expect(reconciled[1]).toBe(previous[0]);
    expect(reconciled[2]).toBe(previous[1]);
  });

  it('preserves identity for the remaining verses after deleting a line in the middle', () => {
    const previous = parsePlainLyrics('gato\nperro\nloro\n').stanzas[0].verses;
    const next = parsePlainLyrics('gato\nloro\n').stanzas[0].verses;
    const reconciled = reconcileVerses(previous, next);

    expect(reconciled[0]).toBe(previous[0]);
    expect(reconciled[1]).toBe(previous[2]);
  });

  it('consumes each duplicate previous verse at most once', () => {
    const previous = parsePlainLyrics('gato\ngato\n').stanzas[0].verses;
    const next = parsePlainLyrics('gato\ngato\n').stanzas[0].verses;
    const reconciled = reconcileVerses(previous, next);

    expect(reconciled[0]).toBe(previous[0]);
    expect(reconciled[1]).toBe(previous[1]);
    expect(new Set(reconciled).size).toBe(reconciled.length);
  });

  it('survives a printPlainLyrics/parsePlainLyrics round trip stanza by stanza (fixture)', () => {
    const song = parseLyrics(FIXTURE);

    for (const stanza of song.stanzas) {
      const previous = stanza.verses;
      const plainText = printPlainLyrics({
        title: null,
        comments: [],
        stanzas: [{ ...stanza, title: null, comments: [] }],
        range: stanza.range,
      });
      const next = parsePlainLyrics(plainText).stanzas[0]?.verses ?? [];
      const reconciled = reconcileVerses(previous, next);

      expect(reconciled.length).toBe(previous.length);
      reconciled.forEach((verse, i) => {
        expect(verse).toBe(previous[i]);
      });
    }
  });
});
