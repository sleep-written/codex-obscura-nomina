import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import type { AlterableMarker, VerseNode } from '@codex-obscura-nomina/lyrics-language';
import { versePieces } from '../lyrics/verse-pieces';

@Component({
  selector: 'app-verse-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verse-view.html',
  styleUrl: './verse-view.scss',
})
export class VerseView {
  readonly verse = input.required<VerseNode>();
  readonly changed = output<void>();

  // linkedSignal: se recalcula cuando cambia el objeto `verse`, y además es
  // escribible para poder recalcular tras un toggle (que muta el AST en sitio
  // y por tanto es invisible para el sistema de señales).
  protected readonly pieces = linkedSignal(() => versePieces(this.verse()));

  protected toggle(marker: AlterableMarker): void {
    marker.active = !marker.active;
    this.pieces.set(versePieces(this.verse()));
    this.changed.emit();
  }
}
