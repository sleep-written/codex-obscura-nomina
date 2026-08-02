import { ChangeDetectionStrategy, Component, computed, effect, output, input, viewChild } from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { stanzaMetrics } from '@codex-obscura-nomina/lyrics-language';
import type { StanzaVm } from '../song/song-vm';
import { VerseView } from '../verse-view/verse-view';

@Component({
  selector: 'app-stanza-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkTextareaAutosize,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    VerseView,
  ],
  templateUrl: './stanza-card.html',
  styleUrl: './stanza-card.scss',
})
export class StanzaCard {
  readonly stanza = input.required<StanzaVm>();

  /** Número de la estrofa dentro de la canción, 1-indexado. */
  readonly position = input.required<number>();

  readonly titleChanged = output<string>();
  readonly textChanged = output<string>();
  readonly targetChanged = output<number | null>();
  readonly versesChanged = output<void>();
  readonly removed = output<void>();

  private readonly autosize = viewChild(CdkTextareaAutosize);

  protected readonly target = computed(() => this.stanza().target ?? null);

  /**
   * Eje común para las barras de todos los versos de la card: sin él cada
   * verso se dibujaría contra su propia escala y compararlos no diría nada.
   * `max` no depende del estado de los marcadores (activarlos solo fusiona
   * notas ya contadas), así que no hace falta recalcularlo tras un toggle.
   */
  protected readonly scale = computed(() =>
    Math.max(stanzaMetrics(this.stanza().node).max, this.target() ?? 0, 1),
  );

  constructor() {
    // cdkTextareaAutosize solo reacciona al evento `input` del DOM: al cargar
    // un archivo el valor se pone programáticamente y hay que forzar el resize.
    effect(() => {
      this.stanza().rawText;
      this.autosize()?.resizeToFitContent(true);
    });
  }

  /** Vacío, 0 o basura desactivan el objetivo en vez de dejar un número inválido. */
  protected onTarget(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.targetChanged.emit(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }
}
