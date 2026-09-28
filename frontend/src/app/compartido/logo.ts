import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { urlServidor } from '../core/empresa';
import { iniciales } from '../core/formato';

/** Logo del negocio o, si no ha subido uno, sus iniciales. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'logo' },
  template: `
    @if (url(); as u) { <img [src]="u" alt=""> } @else { <span class="ini">{{ letras() }}</span> }
  `,
})
export class Logo {
  /** Dirección del logo tal como la entrega la API ("/api/…"), o null. */
  readonly logoUrl = input<string | null | undefined>(null);
  readonly nombre = input('');
  protected url = computed(() => urlServidor(this.logoUrl()));
  protected letras = computed(() => iniciales(this.nombre()));
}
