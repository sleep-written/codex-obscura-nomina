import type { AlterableMarker } from '@codex-obscura-nomina/lyrics-language';

export function markerSymbol(marker: AlterableMarker): string {
  switch (marker.kind) {
    case 'diaeresis': return marker.active ? '+' : '_';
    case 'synaeresis': return marker.active ? '%' : '/';
    case 'sinalefa': return marker.active ? '&' : ' ';
  }
}
