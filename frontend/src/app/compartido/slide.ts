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
    :host { display: block; height: 100%; container-type: inline-size; }
    .sl { position: relative; overflow: hidden; border-radius: 18px; min-height: 0; height: 100%; color: #fff; display: flex; align-items: center; }
    .sl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .sl-velo { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.08) 100%), linear-gradient(0deg, rgba(0,0,0,.35), transparent 40%); }
    .sl-txt { position: relative; display: grid; gap: clamp(4px, 1.6cqw, 10px); justify-items: start; padding: clamp(10px, 3cqw, 24px) clamp(12px, 3cqw, 28px) clamp(14px, 4cqw, 34px) clamp(14px, 6cqw, 60px); max-width: min(560px, 88%); text-align: left; }
    h3 { margin: 0; font-size: clamp(16px, 5.2cqw, 36px); font-weight: 800; line-height: 1.08; letter-spacing: -.02em; text-shadow: 0 2px 14px rgba(0,0,0,.55); color: #fff; text-wrap: balance; overflow-wrap: anywhere; }
    p { font-size: clamp(11px, 2.6cqw, 17px); color: #fff; text-shadow: 0 1px 10px rgba(0,0,0,.6); line-height: 1.35; overflow-wrap: anywhere; margin: 0; }
    .sl-btn { margin-top: 6px; background: #fff; color: #111; font-weight: 700; font-size: clamp(11px, 1.9cqw, 14px); padding: clamp(6px, 1.2cqw, 10px) clamp(12px, 2.4cqw, 20px); border-radius: 999px; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
    
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
