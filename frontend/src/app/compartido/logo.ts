import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { urlImagen } from '../core/api';
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
  readonly logoId = input<number | null>(null);
  readonly nombre = input('');
  protected url = computed(() => urlImagen(this.logoId()));
  protected letras = computed(() => iniciales(this.nombre()));
}
