import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Foto } from '../compartido/foto';
import { Icono } from '../compartido/icono';
import { Slider } from './slider';
import { SelectorProducto, Seleccion } from '../compartido/selector-producto';
import { revelarAlDesplazar, sinMovimiento } from '../core/animar';
import { Avisos } from '../core/avisos';
import { Carrito } from '../core/carrito';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { DiaLargoPipe, DineroPipe, cuando, etiquetaPromo } from '../core/formato';
import { Producto, Promocion } from '../core/modelos';

interface Seccion { id: string; nombre: string; productos: Producto[]; }

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, RouterLink, Foto, Icono, Slider, SelectorProducto, DineroPipe, DiaLargoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      @if (estado.error() && !estado.catalogo()) {
        <div class="wrap">
          <div class="empty" style="margin-top:28px">
            <p>{{ estado.error() }}</p>
            <p style="margin-top:12px"><button class="ghost" (click)="estado.cargar()">Intentar de nuevo</button></p>
          </div>
        </div>
      }

      @if (estado.catalogo(); as c) {
        <section class="lp" aria-label="Presentación">
          <span class="lp-blob b1" aria-hidden="true"></span><span class="lp-blob b2" aria-hidden="true"></span>
          <div class="wrap lp-grid">
            <div class="lp-texto">
              @if (c.tienda.modoPedido === 'PROGRAMADO') {
                <span class="lp-estado"><i></i> Próxima entrega · {{ c.tienda.fechaServicio | diaLargo }}</span>
              } @else if (c.tienda.enHorario) {
                <span class="lp-estado abierta"><i></i> Abierto ahora</span>
              } @else {
                <span class="lp-estado cerrada"><i></i> Cerrado{{ c.tienda.proximaApertura ? ' · abrimos ' + texto(c.tienda.proximaApertura) : '' }}</span>
              }
              <h1>{{ c.tienda.tituloPortada || c.tienda.nombre }}</h1>
              @if (c.tienda.mensaje) { <p class="lp-sub">{{ c.tienda.mensaje }}</p> }
              <div class="lp-botones">
                <button class="lp-btn principal" type="button" (click)="irAlMenu()">Ver el menú</button>
                <a class="lp-btn" [routerLink]="emp.url('/seguimiento')">Seguir mi pedido</a>
              </div>
              <ul class="lp-datos">
                @if (c.tienda.modoPedido !== 'PROGRAMADO') { <li><b>{{ c.tienda.tiempoMin }}–{{ c.tienda.tiempoMax }} min</b><span>de entrega</span></li> }
                @if (c.tienda.cierre) { <li><b>{{ texto(c.tienda.cierre) }}</b><span>{{ c.tienda.modoPedido === 'PROGRAMADO' ? 'cierre de pedidos' : 'pedidos hasta' }}</span></li> }
                @if (entrega()) { <li><b>{{ entrega() }}</b><span>cómo recibirlo</span></li> }
              </ul>
            </div>
            @if (portada().length) {
              <div class="lp-fotos" aria-hidden="true">
                @for (p of portada(); track p.id; let i = $index) {
                  <figure [class]="'lp-foto f' + i"><app-foto [imagenId]="p.imagenId" [nombre]="p.nombre" /><figcaption>{{ p.nombre }}</figcaption></figure>
                }
              </div>
            }
          </div>
        </section>

        <section class="pasos wrap" aria-label="Cómo pedir">
          <div class="paso"><span class="n">1</span><div><b>Escoge</b><span>Mira el menú y agrega lo que se te antoje.</span></div></div>
          <div class="paso"><span class="n">2</span><div><b>Dinos dónde</b><span>Domicilio a tu puerta o recoges en el local.</span></div></div>
          <div class="paso"><span class="n">3</span><div><b>Paga y sigue tu pedido</b><span>Elige cómo pagar y míralo avanzar en vivo.</span></div></div>
        </section>

        <div class="wrap" id="menu">
        @if (!c.tienda.abierto) {
          <div class="alerta mala">Por ahora no estamos recibiendo pedidos. Escríbenos por WhatsApp y te avisamos cuándo abrimos.</div>
        }

        @if (c.banners.length) {
          <app-slider class="rp-slider" [banners]="c.banners" (pedir)="irAPrimeraCategoria()" />
        }

        @if (c.promociones.length) {
          <div class="promos rp-promos" aria-label="Promociones">
            @for (p of c.promociones; track p.id) {
              <div class="promo">
                <span class="tag num">{{ etiqueta(p) }}</span>
                <div><b>{{ p.nombre }}</b><span class="d">{{ p.descripcion }}</span></div>
              </div>
            }
          </div>
        }

        <div class="rp-barra">
          <label class="rp-buscar">
            <app-icono nombre="buscar" />
            <input type="search" name="buscar" placeholder="¿Qué se te antoja hoy?" autocomplete="off" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" aria-label="Buscar en el menú">
            @if (busqueda()) { <button type="button" class="rp-x" (click)="busqueda.set('')" aria-label="Borrar búsqueda"><app-icono nombre="cerrar" /></button> }
          </label>
          @if (todas().length > 1 && !busqueda()) {
            <nav class="rp-cats" aria-label="Categorías">
              @for (s of todas(); track s.id) {
                <button type="button" [attr.aria-pressed]="activa() === s.id" (click)="ir(s.id)">
                  <span class="rp-circulo"><app-foto [imagenId]="s.productos[0].imagenId" [nombre]="s.nombre" /></span>
                  <span class="rp-nombre">{{ s.nombre }}</span>
                </button>
              }
            </nav>
          }
        </div>

        @for (s of secciones(); track s.id) {
          <section class="seccion" [id]="'cat-' + s.id">
            <div class="sec-h"><h2>{{ s.nombre }}</h2><span class="muted">{{ s.productos.length }} {{ s.productos.length === 1 ? 'producto' : 'productos' }}</span></div>
            <div class="rp-lista">
              @for (p of s.productos; track p.id) {
                <article class="item" [class.agotado]="!p.disponible">
                  <button type="button" class="item-info" (click)="abrir(p)" [disabled]="!p.disponible" [attr.aria-label]="'Ver ' + p.nombre">
                    <span class="chips">
                      @if (p.etiqueta) { <span class="chip hot">{{ p.etiqueta }}</span> }
                      @if (p.precioHoy < p.precio) { <span class="chip oferta">Oferta</span> }
                      @if (!p.disponible) { <span class="chip">Agotado</span> }
                    </span>
                    <h3>{{ p.nombre }}</h3>
                    <span class="desc">{{ p.descripcion }}</span>
                    <span class="price num">@if (p.grupos.length) {<small class="muted">desde </small>}{{ p.precioHoy | dinero }}@if (p.precioHoy < p.precio) {<s>{{ p.precio | dinero }}</s>}</span>
                  </button>
                  <div class="item-foto">
                    <button type="button" class="art" (click)="abrir(p)" [disabled]="!p.disponible" tabindex="-1" aria-hidden="true">
                      <app-foto [imagenId]="p.imagenId" [nombre]="p.nombre" />
                    </button>
                    @if (p.disponible && c.tienda.abierto) {
                      @if (p.grupos.length) {
                        <button type="button" class="mas-btn" (click)="abrir(p)" [attr.aria-label]="'Personalizar ' + p.nombre">
                          @if (carrito.cantidadDe(p.id); as q) { <span class="num">{{ q }}</span> } @else { + }
                        </button>
                      } @else if (carrito.cantidadDe(p.id); as q) {
                        <div class="stepper rp-step">
                          <button type="button" (click)="carrito.quitarUno(p.id)" aria-label="Quitar uno">−</button>
                          <span class="num">{{ q }}</span>
                          <button type="button" (click)="sumar($event, p.id)" aria-label="Agregar uno">+</button>
                        </div>
                      } @else {
                        <button type="button" class="mas-btn" (click)="sumar($event, p.id)" [attr.aria-label]="'Agregar ' + p.nombre">+</button>
                      }
                    }
                  </div>
                </article>
              }
            </div>
          </section>
        } @empty {
          <div class="empty" style="margin-top:20px">
            @if (busqueda()) { No encontramos «{{ busqueda() }}». Prueba con otra palabra. } @else { Pronto vas a ver aquí nuestros productos. }
          </div>
        }
        <div class="fin-catalogo"></div>
        </div>
      } @else if (!estado.error()) {
        <div class="wrap" aria-busy="true" aria-label="Cargando el menú">
          <div class="hero"><div class="stack"><div class="esqueleto" style="height:56px;width:85%"></div><div class="esqueleto" style="height:20px;width:60%"></div></div>
            <div class="esqueleto" style="height:120px"></div></div>
          <div class="grid" style="margin-top:24px">
            @for (i of [1, 2, 3]; track i) { <div class="esqueleto" style="height:330px"></div> }
          </div>
        </div>
      }
    </main>

    @if (abierto(); as p) {
      <app-selector-producto [producto]="p" (elegido)="agregar($event)" (cerrar)="abierto.set(null)" />
    }
  `,
})
export class CatalogoPage {
  protected estado = inject(EstadoTienda);
  protected carrito = inject(Carrito);
  protected emp = inject(EmpresaActual);
  private avisos = inject(Avisos);

  protected abierto = signal<Producto | null>(null);
  protected activa = signal('');
  private raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private animado = false;

  /** Hasta tres productos con foto para la portada. */
  protected portada = computed(() => (this.estado.catalogo()?.productos ?? []).filter((p) => p.imagenId && p.disponible).slice(0, 3));

  constructor() {
    // Cuando llega el menú, la portada entra con movimiento y el resto aparece al hacer scroll.
    effect(() => {
      if (!this.estado.catalogo() || this.animado) return;
      this.animado = true;
      requestAnimationFrame(() => this.animarPortada());
    });
    const limpiar = revelarAlDesplazar(this.raiz, '.paso, .sec-h, .item, .promo, .rp-slider');
    // La categoría marcada sigue al scroll, y su círculo se centra en la barra.
    let espera = false;
    const alDesplazar = () => {
      if (espera) return;
      espera = true;
      requestAnimationFrame(() => {
        espera = false;
        let id = '';
        for (const sec of Array.from(this.raiz.querySelectorAll<HTMLElement>('.seccion'))) if (sec.getBoundingClientRect().top <= 190) id = sec.id.replace('cat-', '');
        this.raiz.querySelector('.rp-barra')?.classList.toggle('pegada', (this.raiz.querySelector('.rp-barra')?.getBoundingClientRect().top ?? 99) <= 60);
        if (id && id !== this.activa()) {
          this.activa.set(id);
          requestAnimationFrame(() => this.raiz.querySelector('.rp-cats button[aria-pressed=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
        }
      });
    };
    addEventListener('scroll', alDesplazar, { passive: true });
    inject(DestroyRef).onDestroy(() => { limpiar(); removeEventListener('scroll', alDesplazar); this.flotando?.kill?.(); ScrollTrigger.getAll().forEach((t) => t.kill()); });
  }

  private flotando: { kill?: () => void } | null = null;

  private animarPortada(): void {
    if (sinMovimiento()) return;
    const r = this.raiz;
    gsap.registerPlugin(ScrollTrigger);
    const t = gsap.timeline({ defaults: { ease: 'power3.out' } });
    t.fromTo(r.querySelector('.lp-estado'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, clearProps: 'all' })
      .fromTo(r.querySelector('.lp h1'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.6, clearProps: 'all' }, '-=0.2')
      .fromTo(r.querySelectorAll('.lp-sub, .lp-botones, .lp-datos li'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, clearProps: 'all' }, '-=0.3')
      .fromTo(r.querySelectorAll('.lp-foto'), { opacity: 0, scale: 0.8, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'back.out(1.5)' }, 0.2);
    // Las fotos y los círculos de fondo flotan despacio.
    this.flotando = gsap.to(r.querySelectorAll('.lp-foto'), { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.5, from: 'start' } });
    gsap.to(r.querySelectorAll('.lp-blob'), { x: 30, y: -20, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.5 });
    // Efecto de profundidad al bajar: las fotos suben más rápido que el texto y los círculos de fondo se alejan.
    const alBajar = { trigger: r.querySelector('.lp'), start: 'top top', end: 'bottom top', scrub: true };
    gsap.to(r.querySelector('.lp-fotos'), { yPercent: -14, ease: 'none', scrollTrigger: alBajar });
    gsap.to(r.querySelector('.lp-texto'), { yPercent: 10, opacity: 0.35, ease: 'none', scrollTrigger: alBajar });
    gsap.to(r.querySelectorAll('.lp-blob'), { yPercent: 40, ease: 'none', scrollTrigger: alBajar });
  }

  /** Agrega un producto y hace «saltar» el botón para que se note. */
  protected sumar(ev: Event, id: number): void {
    this.carrito.agregar(id, []);
    const el = (ev.currentTarget as HTMLElement | null)?.closest('.item-foto')?.querySelector('.mas-btn, .rp-step');
    if (el && !sinMovimiento()) gsap.fromTo(el, { scale: 0.8 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', clearProps: 'transform' });
  }

  protected irAPrimeraCategoria(): void {
    const primera = this.todas()[0];
    if (primera) this.ir(primera.id);
  }

  protected irAlMenu(): void {
    document.getElementById('menu')?.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
  }

  protected busqueda = signal('');

  /** Todas las categorías con productos (para los círculos de arriba). */
  protected todas = computed<Seccion[]>(() => {
    const c = this.estado.catalogo();
    if (!c) return [];
    const out: Seccion[] = c.categorias
      .map((cat) => ({ id: String(cat.id), nombre: cat.nombre, productos: c.productos.filter((p) => p.categoriaId === cat.id) }))
      .filter((s) => s.productos.length);
    const sueltos = c.productos.filter((p) => p.categoriaId == null || !c.categorias.some((x) => x.id === p.categoriaId));
    if (sueltos.length) out.push({ id: 'otros', nombre: out.length ? 'Otros' : 'Nuestros productos', productos: sueltos });
    return out;
  });

  /** Lo que se muestra: todo el menú, o solo lo que coincide con la búsqueda. */
  protected secciones = computed<Seccion[]>(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.todas();
    return this.todas()
      .map((sec) => ({ ...sec, productos: sec.productos.filter((p) => (p.nombre + ' ' + (p.descripcion ?? '') + ' ' + (p.etiqueta ?? '')).toLowerCase().includes(q)) }))
      .filter((sec) => sec.productos.length);
  });

  protected entrega = computed(() => {
    const t = this.estado.catalogo()?.tienda;
    if (!t) return '';
    const partes: string[] = [];
    if (t.domicilioActivo) {
      partes.push(t.zonas.length ? 'Domicilio según tu zona'
        : t.domicilioValor ? `Domicilio ${this.precio(t.domicilioValor)}` : 'Domicilio gratis');
    }
    if (t.recogerActivo) partes.push('Recoger en el local');
    return partes.join(' · ');
  });

  protected texto(iso: string): string { return cuando(iso); }
  protected precio(n: number): string { return new DineroPipe().transform(n); }
  protected etiqueta(p: Promocion): string { return etiquetaPromo(p); }

  protected abrir(p: Producto): void {
    if (!p.disponible) return;
    if (!p.grupos.length) { this.carrito.agregar(p.id, []); return; }
    this.abierto.set(p);
  }

  protected agregar(s: Seleccion): void {
    this.carrito.agregar(s.productoId, s.opcionIds, s.cantidad);
    this.abierto.set(null);
    this.avisos.mostrar('Agregado al carrito');
  }

  protected ir(id: string): void {
    this.activa.set(id);
    document.getElementById('cat-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
