import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { urlImagen } from '../core/api';
import { iniciales } from '../core/formato';

/** Foto de un producto. Sin foto (o si no carga) muestra las iniciales sobre el color de la marca. */
@Component({
  selector: 'app-foto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url() && !fallo()) {
      <img [src]="url()" [alt]="nombre()" loading="lazy" decoding="async" (error)="fallo.set(true)">
    } @else {
      <span class="ini" aria-hidden="true">{{ letras() }}</span>
    }
  `,
  styles: `
    :host { container-type: size; display: grid; place-items: center; width: 100%; height: 100%; overflow: hidden;
      background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 30%, var(--surface-2)), color-mix(in srgb, var(--brand-2) 18%, var(--surface-2))); }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ini { font-family: var(--display); font-weight: 800; font-size: clamp(14px, 36cqmin, 64px); color: color-mix(in srgb, var(--brand-2) 70%, var(--ink)); opacity: .55; letter-spacing: -.02em; }
  `,
})
export class Foto {
  readonly imagenId = input<number | null>(null);
  readonly nombre = input('');
  protected fallo = signal(false);
  protected url = computed(() => urlImagen(this.imagenId()));
  protected letras = computed(() => iniciales(this.nombre()));
}
