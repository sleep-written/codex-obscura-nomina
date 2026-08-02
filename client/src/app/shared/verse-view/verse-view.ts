import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import type { AlterableMarker, VerseNode } from '@codex-obscura-nomina/lyrics-language';
import { verseMetrics } from '@codex-obscura-nomina/lyrics-language';

/** Cuán lejos está el verso de las notas que la estrofa pide por verso. */
export type TargetStatus = 'none' | 'hit' | 'near' | 'far';

const KIND_LABEL: Record<AlterableMarker['kind'], string> = {
  diaeresis: 'diéresis',
  synaeresis: 'sinéresis',
  sinalefa: 'sinalefa',
};

@Component({
  selector: 'app-verse-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verse-view.html',
  styleUrl: './verse-view.scss',
  host: { '[attr.data-status]': 'status()' },
})
export class VerseView {
  readonly verse = input.required<VerseNode>();

  /** Número del verso dentro de la estrofa, 1-indexado. */
  readonly position = input.required<number>();

  /**
   * Notas que representa el ancho completo de la barra. Lo fija la estrofa, no
   * el verso: el eje solo sirve si es el mismo para todos los versos de la card.
   */
  readonly scale = input.required<number>();

  /** Notas por verso que pide la estrofa; `null` si no hay objetivo. */
  readonly target = input<number | null>(null);

  readonly changed = output<void>();

  // linkedSignal: se recalcula cuando cambia el objeto `verse`, y además es
  // escribible para poder recalcular tras un toggle (que muta el AST en sitio
  // y por tanto es invisible para el sistema de señales).
  protected readonly metrics = linkedSignal(() => verseMetrics(this.verse()));

  protected readonly label = computed(() => String(this.position()).padStart(2, '0'));

  protected readonly status = computed<TargetStatus>(() => {
    const target = this.target();
    if (target === null) return 'none';

    const { count, min, max } = this.metrics();
    if (count === target) return 'hit';
    return target >= min && target <= max ? 'near' : 'far';
  });

  /** Notas que sobran (+) o faltan (−) respecto del objetivo. */
  protected readonly delta = computed(() => {
    const target = this.target();
    if (target === null) return '';

    const diff = this.metrics().count - target;
    if (diff === 0) return '0';
    return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
  });

  /** Posiciones sobre el eje compartido, ya en porcentaje listo para CSS. */
  protected readonly bar = computed(() => {
    const { count, min, max } = this.metrics();
    const scale = Math.max(this.scale(), 1);
    const pct = (notes: number) => `${(notes / scale) * 100}%`;
    const target = this.target();

    return {
      slackLeft: pct(min),
      slackWidth: pct(max - min),
      cursor: pct(count),
      target: target === null ? null : pct(Math.min(target, scale)),
    };
  });

  protected kindLabel(marker: AlterableMarker): string {
    return KIND_LABEL[marker.kind];
  }

  protected toggle(marker: AlterableMarker): void {
    marker.active = !marker.active;
    this.metrics.set(verseMetrics(this.verse()));
    this.changed.emit();
  }
}
