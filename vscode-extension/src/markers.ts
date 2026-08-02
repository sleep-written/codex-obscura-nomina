/**
 * Pure logic for toggling an `AlterableMarker`'s DSL symbol — no `vscode`
 * import, testable with `node --test`. Never decides WHICH symbol is
 * phonetically "correct" (same rule as `providers/completion-context.ts`):
 * only computes what a given user-initiated toggle produces.
 *
 * Deliberately does NOT offer switching between diéresis and sinéresis
 * (e.g. `_` -> `%`) even though both can produce the same "one syllable"
 * effect — they're different phenomena in the DSL (see the README), and
 * suggesting one from the other's hover reads as the tool conflating them.
 * Confirmed with the user after an earlier version did exactly that.
 */
import type { AlterableMarker } from '@codex-obscura-nomina/lyrics-language';

const SYMBOL: Record<`${AlterableMarker['kind']}:${'true' | 'false'}`, string> = {
    'diaeresis:true': '+',
    'diaeresis:false': '_',
    'synaeresis:true': '%',
    'synaeresis:false': '/',
    'sinalefa:true': '&',
    'sinalefa:false': ' '
};

const DESCRIPTION: Record<`${AlterableMarker['kind']}:${'true' | 'false'}`, string> = {
    'diaeresis:true': 'Diéresis activada (`+`) — separa el par vocálico en dos sílabas.',
    'diaeresis:false': 'Diéresis desactivada (`_`) — el par vocálico queda en una sola sílaba.',
    'synaeresis:true': 'Sinéresis activada (`%`) — el par vocálico queda en una sola sílaba.',
    'synaeresis:false': 'Sinéresis desactivada (`/`) — separa el par vocálico en dos sílabas.',
    'sinalefa:true': 'Sinalefa activada (`&`) — funde esta palabra con la siguiente en una sola sílaba métrica.',
    'sinalefa:false': 'Sinalefa desactivada (espacio) — esta palabra no se funde con la siguiente.'
};

export function symbolFor(kind: AlterableMarker['kind'], active: boolean): string {
    return SYMBOL[`${kind}:${active}`];
}

export function describeMarkerState(kind: AlterableMarker['kind'], active: boolean): string {
    return DESCRIPTION[`${kind}:${active}`];
}

/** The symbol produced by flipping `active`, same `kind` (`+`↔`_`, `%`↔`/`, `&`↔` `). */
export function toggleSymbol(marker: AlterableMarker): string {
    return symbolFor(marker.kind, !marker.active);
}
