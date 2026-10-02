import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { urlImagen } from '../core/empresa';

/** Una lámina del carrusel (la misma que ve el cliente y la vista previa del editor). */
@Component({
  selector: 'app-slide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sl" [style.background]="fondo()">
      @if (url(); as u) { <img class="sl-img" [src]="u" alt="" loading="lazy" decoding="async"> <span class="sl-velo"></span> }
      <div class="sl-txt">
        <h3>{{ titulo() || 'Título del banner' }}</h3>
        @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
        @if (boton()) { <span class="sl-btn">{{ boton() }}</span> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .sl { position: relative; overflow: hidden; border-radius: 18px; min-height: 190px; height: 100%; color: #fff; display: flex; align-items: center; }
    .sl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .sl-velo { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,.12) 75%); }
    .sl-txt { position: relative; display: grid; gap: 8px; justify-items: start; padding: 24px 28px; max-width: min(520px, 80%); }
    h3 { font-size: clamp(22px, 3.4vw, 36px); font-weight: 800; line-height: 1.08; letter-spacing: -.02em; text-shadow: 0 2px 12px rgba(0,0,0,.25); color: #fff; }
    p { font-size: clamp(14px, 1.6vw, 17px); opacity: .92; text-shadow: 0 1px 8px rgba(0,0,0,.25); }
    .sl-btn { margin-top: 4px; background: #fff; color: #111; font-weight: 700; font-size: 14px; padding: 9px 18px; border-radius: 999px; }
  `,
})
export class Slide {
  readonly titulo = input('');
  readonly subtitulo = input('');
  readonly boton = input('');
  readonly imagenId = input<number | null>(null);
  readonly color = input('');
  protected url = computed(() => urlImagen(this.imagenId()));
  protected fondo = computed(() => {
    const c = this.color();
    return c ? `linear-gradient(120deg, ${c}, color-mix(in srgb, ${c} 60%, #000))`
             : 'linear-gradient(120deg, var(--brand), color-mix(in srgb, var(--brand) 55%, var(--brand-2)))';
  });
}
