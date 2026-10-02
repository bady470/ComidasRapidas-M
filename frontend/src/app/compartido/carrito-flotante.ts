import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { sinMovimiento } from '../core/animar';
import { Carrito } from '../core/carrito';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { DineroPipe } from '../core/formato';

/** Último toque en la página: de ahí sale el cometa cuando ese toque agrega algo al carrito. */
interface Toque { x: number; y: number; foto: string | null; cuando: number; }

const CHISPAS = 12;

/**
 * Carrito flotante en el medio de la derecha. Cada vez que se agrega algo (desde el menú, el «+» o la hoja de un
 * producto), sale un cometa desde donde se tocó hasta el carrito, con la foto del producto, y el carrito «salta».
 * No hace falta tocar cada botón: escucha el número de unidades del carrito y el último toque en la página.
 */
@Component({
  selector: 'app-carrito-flotante',
  imports: [RouterLink, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="cf-ancla" [class.con-barra]="carrito.totalUnidades() > 0">
        @if (carrito.totalUnidades(); as n) {
          <!-- En el celular, con algo en el carrito, el botón se vuelve una barra abajo con cuánto llevas. -->
          <a class="cf-barra" [routerLink]="emp.url('/carrito')">
            <span class="cf-barra-txt"><b>Ver carrito</b><small>{{ n }} {{ n === 1 ? 'producto' : 'productos' }}</small></span>
            <b class="cf-barra-total num">{{ subtotal() | dinero }}</b>
          </a>
        }
        <a #boton class="cf" [class.lleno]="carrito.totalUnidades() > 0" [routerLink]="emp.url('/carrito')"
           [attr.aria-label]="'Ver carrito: ' + carrito.totalUnidades() + (carrito.totalUnidades() === 1 ? ' producto' : ' productos')">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6.2" />
            <circle cx="10" cy="20.5" r="1.3" /><circle cx="18" cy="20.5" r="1.3" />
          </svg>
          @if (carrito.totalUnidades()) { <span #insignia class="cf-n num">{{ carrito.totalUnidades() }}</span> }
          <span class="cf-txt">{{ carrito.totalUnidades() ? 'Ver carrito' : 'Tu carrito está vacío' }}</span>
        </a>
      </div>
    }
  `,
})
export class CarritoFlotante {
  protected carrito = inject(Carrito);
  protected emp = inject(EmpresaActual);
  private estado = inject(EstadoTienda);
  /** El layout lo oculta en la página del carrito. */
  readonly visible = input(true);

  /** Lo que llevas a precio de hoy con sus adiciones (las promociones y el domicilio se calculan en el carrito). */
  protected subtotal = computed(() => {
    const productos = this.estado.catalogo()?.productos ?? [];
    return this.carrito.lineas().reduce((suma, l) => {
      const p = productos.find((x) => x.id === l.productoId);
      if (!p) return suma;
      const extras = p.grupos.flatMap((g) => g.opciones).filter((o) => l.opcionIds.includes(o.id)).reduce((a, o) => a + o.precioExtra, 0);
      return suma + (p.precioHoy + extras) * l.cantidad;
    }, 0);
  });

  private boton = viewChild<ElementRef<HTMLElement>>('boton');
  private insignia = viewChild<ElementRef<HTMLElement>>('insignia');
  private toque: Toque | null = null;
  private antes: number | null = null;

  constructor() {
    const alTocar = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      const foto = el?.closest('.card, .item, .hoja')?.querySelector<HTMLImageElement>('app-foto img')?.currentSrc ?? null;
      this.toque = { x: e.clientX, y: e.clientY, foto, cuando: performance.now() };
    };
    document.addEventListener('pointerdown', alTocar, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', alTocar, { capture: true }));

    // Solo cuando SUBE el número de unidades (agregar); al quitar o al cargar la página no hay cometa.
    effect(() => {
      const n = this.carrito.totalUnidades();
      untracked(() => {
        const antes = this.antes;
        this.antes = n;
        if (antes !== null && n > antes) requestAnimationFrame(() => this.lanzar(n - antes));
      });
    });
  }

  private lanzar(cuantos: number): void {
    const boton = this.boton()?.nativeElement;
    if (!boton) return;
    const destino = boton.getBoundingClientRect();
    const x1 = destino.left + destino.width / 2;
    const y1 = destino.top + destino.height / 2;
    const t = this.toque && performance.now() - this.toque.cuando < 1500 ? this.toque : null;
    this.toque = null;
    if (sinMovimiento() || !t) { this.celebrar(boton, cuantos); return; }

    const x0 = t.x;
    const y0 = t.y;
    // Arco hacia arriba: el punto de control queda por encima de los dos extremos.
    const cx = x0 + (x1 - x0) * 0.35;
    const cy = Math.max(24, Math.min(y0, y1) - Math.min(220, Math.abs(x1 - x0) * 0.45 + 80));
    const punto = (p: number) => ({
      x: (1 - p) * (1 - p) * x0 + 2 * (1 - p) * p * cx + p * p * x1,
      y: (1 - p) * (1 - p) * y0 + 2 * (1 - p) * p * cy + p * p * y1,
    });

    const capa = document.createElement('div');
    capa.className = 'cometa-capa';
    document.body.appendChild(capa);
    const quitar = () => capa.remove();
    setTimeout(quitar, 2500); // por si la pestaña se oculta a mitad del vuelo

    // Cola: chispas que siguen el mismo camino un poco más tarde, cada vez más pequeñas y transparentes.
    for (let i = CHISPAS; i >= 1; i--) {
      const chispa = document.createElement('span');
      chispa.className = 'cometa-chispa';
      const tam = Math.max(4, 16 - i);
      chispa.style.width = chispa.style.height = tam + 'px';
      capa.appendChild(chispa);
      const avance = { p: 0 };
      gsap.to(avance, {
        p: 1, duration: 0.75, delay: i * 0.022, ease: 'power2.in',
        onUpdate: () => {
          const { x, y } = punto(avance.p);
          gsap.set(chispa, { x: x - tam / 2, y: y - tam / 2, opacity: (1 - i / (CHISPAS + 2)) * (1 - avance.p * 0.6) });
        },
        onComplete: () => chispa.remove(),
      });
    }

    // Cabeza: la foto del producto (o un punto de luz) que se encoge al llegar.
    const cabeza = document.createElement('span');
    cabeza.className = 'cometa-cabeza';
    if (t.foto) cabeza.style.backgroundImage = `url("${t.foto}")`;
    capa.appendChild(cabeza);
    const avance = { p: 0 };
    gsap.to(avance, {
      p: 1, duration: 0.75, ease: 'power2.in',
      onUpdate: () => {
        const { x, y } = punto(avance.p);
        gsap.set(cabeza, { x: x - 22, y: y - 22, scale: 1 - avance.p * 0.6, rotation: avance.p * 300 });
      },
      onComplete: () => { cabeza.remove(); this.celebrar(boton, cuantos); setTimeout(quitar, 400); },
    });
  }

  /** El carrito salta, la insignia late, sale un anillo y un «+1» que sube. */
  private celebrar(boton: HTMLElement, cuantos: number): void {
    if (sinMovimiento()) return;
    gsap.timeline({ onComplete: () => gsap.set(boton, { clearProps: 'transform' }) })
      .to(boton, { scale: 1.24, rotation: -12, duration: 0.12, ease: 'power2.out' })
      .to(boton, { rotation: 10, duration: 0.1 })
      .to(boton, { scale: 1, rotation: -5, duration: 0.12 })
      .to(boton, { rotation: 0, duration: 0.1 });
    const insignia = this.insignia()?.nativeElement;
    if (insignia) gsap.fromTo(insignia, { scale: 0.4 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.45)', clearProps: 'transform' });

    const r = boton.getBoundingClientRect();
    const anillo = document.createElement('span');
    anillo.className = 'cometa-anillo';
    Object.assign(anillo.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(anillo);
    gsap.fromTo(anillo, { scale: 1, opacity: 0.7 }, { scale: 1.9, opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => anillo.remove() });

    const mas = document.createElement('span');
    mas.className = 'cometa-mas num';
    mas.textContent = '+' + cuantos;
    Object.assign(mas.style, { left: r.left - 6 + 'px', top: r.top - 4 + 'px' });
    document.body.appendChild(mas);
    gsap.fromTo(mas, { y: 0, opacity: 0, scale: 0.6 }, {
      keyframes: [{ y: -10, opacity: 1, scale: 1.1, duration: 0.18 }, { y: -38, opacity: 0, scale: 1, duration: 0.55, delay: 0.15 }],
      ease: 'power2.out', onComplete: () => mas.remove(),
    });
  }
}
