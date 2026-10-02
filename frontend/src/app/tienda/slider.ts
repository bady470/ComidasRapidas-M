import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal } from '@angular/core';
import { gsap } from 'gsap';
import { Slide } from '../compartido/slide';
import { sinMovimiento } from '../core/animar';
import { Banner } from '../core/modelos';

/** Carrusel de banners de la portada: avanza solo, se desliza con el dedo, flechas y puntos. */
@Component({
  selector: 'app-slider',
  imports: [Slide],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sld" role="region" aria-roledescription="carrusel" aria-label="Promociones"
         (mouseenter)="pausa.set(true)" (mouseleave)="pausa.set(false)" (focusin)="pausa.set(true)" (focusout)="pausa.set(false)"
         (pointerdown)="empezar($event)" (pointerup)="terminar($event)" (pointercancel)="x0 = null">
      <div class="sld-pista" #pista>
        @for (b of banners(); track b.id; let i = $index) {
          <button type="button" class="sld-item" [attr.aria-label]="(i + 1) + ' de ' + banners().length + ': ' + b.titulo" [attr.aria-hidden]="i !== actual()" [tabindex]="i === actual() ? 0 : -1" (click)="clic(i)">
            <app-slide [titulo]="b.titulo" [subtitulo]="b.subtitulo" [boton]="b.boton" [imagenId]="b.imagenId" [color]="b.color" />
          </button>
        }
      </div>
      @if (banners().length > 1) {
        <button type="button" class="sld-flecha izq" (click)="ir(actual() - 1)" aria-label="Anterior">‹</button>
        <button type="button" class="sld-flecha der" (click)="ir(actual() + 1)" aria-label="Siguiente">›</button>
        <div class="sld-puntos">
          @for (b of banners(); track b.id; let i = $index) {
            <button type="button" [class.on]="i === actual()" (click)="ir(i)" [attr.aria-label]="'Ir al banner ' + (i + 1)"></button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .sld { position: relative; border-radius: 18px; overflow: hidden; touch-action: pan-y; user-select: none; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
    .sld-pista { display: flex; will-change: transform; }
    .sld-item { all: unset; box-sizing: border-box; flex: 0 0 100%; min-width: 0; height: clamp(190px, 28vw, 280px); cursor: pointer; display: block; }
    .sld-item:focus-visible { outline: 3px solid var(--brand); outline-offset: -3px; border-radius: 18px; }
    .sld-flecha { position: absolute; top: 50%; translate: 0 -50%; width: 38px; height: 38px; border-radius: 50%; border: 0; background: rgba(255,255,255,.92); color: #111; font-size: 24px; line-height: 1; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.2); display: grid; place-items: center; padding: 0 0 3px; opacity: 0; transition: opacity .2s; }
    .izq { left: 12px; } .der { right: 12px; }
    .sld:hover .sld-flecha, .sld:focus-within .sld-flecha { opacity: 1; }
    @media (hover: none) { .sld-flecha { display: none; } }
    .sld-puntos { position: absolute; left: 0; right: 0; bottom: 10px; display: flex; justify-content: center; gap: 6px; }
    .sld-puntos button { width: 8px; height: 8px; border-radius: 999px; border: 0; padding: 0; background: rgba(255,255,255,.55); cursor: pointer; transition: width .25s, background .25s; }
    .sld-puntos button.on { width: 24px; background: #fff; }
  `,
})
export class Slider {
  readonly banners = input.required<Banner[]>();
  readonly pedir = output<void>();

  protected actual = signal(0);
  protected pausa = signal(false);
  protected x0: number | null = null;
  private raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private movido = false;

  constructor() {
    // Cada vez que cambia la lámina, la pista se desliza hasta ella.
    effect(() => {
      const i = this.actual();
      const pista = this.raiz.querySelector('.sld-pista');
      if (!pista) return;
      if (sinMovimiento()) gsap.set(pista, { xPercent: -100 * i });
      else gsap.to(pista, { xPercent: -100 * i, duration: 0.6, ease: 'power3.inOut' });
    });
    // Avanza sola cada 5 segundos, salvo que el cliente esté encima, la pestaña esté oculta o pida «reducir movimiento».
    // DestroyRef se toma aquí: dentro de afterNextRender ya no hay contexto de inyección.
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      const t = setInterval(() => {
        if (this.pausa() || document.hidden || sinMovimiento() || this.banners().length < 2) return;
        this.ir(this.actual() + 1);
      }, 5000);
      destruir.onDestroy(() => clearInterval(t));
    });
  }

  protected ir(i: number): void {
    const n = this.banners().length;
    if (n) this.actual.set(((i % n) + n) % n);
  }

  protected empezar(ev: PointerEvent): void { this.x0 = ev.clientX; this.movido = false; }

  protected terminar(ev: PointerEvent): void {
    if (this.x0 === null) return;
    const d = ev.clientX - this.x0;
    this.x0 = null;
    if (Math.abs(d) > 40) { this.movido = true; this.ir(this.actual() + (d < 0 ? 1 : -1)); }
  }

  protected clic(i: number): void {
    if (this.movido) { this.movido = false; return; }
    if (i === this.actual()) this.pedir.emit();
  }
}
