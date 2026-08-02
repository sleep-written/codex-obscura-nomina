import type { AlterableMarker } from '../ast/interfaces/index.js';

/**
 * Whether a marker, in its current state, keeps both sides inside the same
 * note (`true`) or splits them into two (`false`).
 *
 * Mirrors the DSL's fixed symbol semantics (see `markerSymbol` in
 * `../ast/printer.js`): `_` (diéresis-off), `%` (sinéresis-on) and `&`
 * (sinalefa-on) fuse; `+` (diéresis-on), `/` (sinéresis-off) and a plain
 * space between words split. Note that `active` means "fuses" for sinéresis
 * and sinalefa but "splits" for diéresis — the flag tracks which symbol was
 * written, not a single shared meaning.
 */
export function markerMerges(marker: AlterableMarker): boolean {
    switch (marker.kind) {
        case 'diaeresis': return !marker.active;
        case 'synaeresis': return marker.active;
        case 'sinalefa': return marker.active;
    }
}
