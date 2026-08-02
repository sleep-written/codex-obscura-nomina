import { ChangeDetectionStrategy, Component, effect, output, input, viewChild } from '@angular/core';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
  readonly titleChanged = output<string>();
  readonly textChanged = output<string>();
  readonly versesChanged = output<void>();
  readonly removed = output<void>();

  private readonly autosize = viewChild(CdkTextareaAutosize);

  constructor() {
    // cdkTextareaAutosize solo reacciona al evento `input` del DOM: al cargar
    // un archivo el valor se pone programáticamente y hay que forzar el resize.
    effect(() => {
      this.stanza().rawText;
      this.autosize()?.resizeToFitContent(true);
    });
  }
}
