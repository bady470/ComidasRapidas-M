import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { gsap } from 'gsap';
import { RouterLink } from '@angular/router';
import { Foto } from '../compartido/foto';
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
  imports: [RouterLink, Foto, SelectorProducto, DineroPipe, DiaLargoPipe],
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

        @if (c.promociones.length) {
          <div class="promos">
            @for (p of c.promociones; track p.id) {
              <div class="promo">
                <span class="tag num">{{ etiqueta(p) }}</span>
                <div><b>{{ p.nombre }}</b><span class="d">{{ p.descripcion }}</span></div>
              </div>
            }
          </div>
        }

        @if (secciones().length > 1) {
          <nav class="cats" aria-label="Categorías">
            @for (s of secciones(); track s.id) {
              <button [attr.aria-pressed]="activa() === s.id" (click)="ir(s.id)">{{ s.nombre }}</button>
            }
          </nav>
        }

        @for (s of secciones(); track s.id) {
          <section class="seccion" [id]="'cat-' + s.id">
            <div class="sec-h"><h2>{{ s.nombre }}</h2><span class="muted">{{ s.productos.length }} {{ s.productos.length === 1 ? 'producto' : 'productos' }}</span></div>
            <div class="grid en-seccion">
              @for (p of s.productos; track p.id) {
                <article class="card" [class.agotado]="!p.disponible">
                  <button class="art" type="button" style="border:0;padding:0;cursor:pointer" (click)="abrir(p)" [disabled]="!p.disponible" [attr.aria-label]="'Ver ' + p.nombre">
                    <app-foto [imagenId]="p.imagenId" [nombre]="p.nombre" />
                  </button>
                  <div class="body">
                    <div class="chips">
                      @if (p.etiqueta) { <span class="chip hot">{{ p.etiqueta }}</span> }
                      @if (p.grupos.length) { <span class="chip">Personalizable</span> }
                      @if (!p.disponible) { <span class="chip">Agotado</span> }
                    </div>
                    <h3>{{ p.nombre }}</h3>
                    <p class="desc">{{ p.descripcion }}</p>
                    <div class="buy">
                      <span class="price num">@if (p.grupos.length) {<small class="muted" style="font-size:13px">desde </small>}{{ p.precioHoy | dinero }}@if (p.precioHoy < p.precio) {<s>{{ p.precio | dinero }}</s>}</span>
                      @if (p.disponible && c.tienda.abierto) {
                        @if (p.grupos.length) {
                          <button class="add" (click)="abrir(p)">{{ carrito.cantidadDe(p.id) ? 'Agregar otro (' + carrito.cantidadDe(p.id) + ')' : 'Agregar' }}</button>
                        } @else if (carrito.cantidadDe(p.id); as q) {
                          <div class="stepper">
                            <button (click)="carrito.quitarUno(p.id)" aria-label="Quitar uno">−</button>
                            <span class="num">{{ q }}</span>
                            <button (click)="carrito.agregar(p.id, [])" aria-label="Agregar uno">+</button>
                          </div>
                        } @else {
                          <button class="add" (click)="carrito.agregar(p.id, [])">Agregar</button>
                        }
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        } @empty {
          <div class="empty" style="margin-top:20px">Pronto vas a ver aquí nuestros productos.</div>
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
    const limpiar = revelarAlDesplazar(this.raiz, '.paso, .sec-h, .card, .promo');
    inject(DestroyRef).onDestroy(() => { limpiar(); this.flotando?.kill?.(); });
  }

  private flotando: { kill?: () => void } | null = null;

  private animarPortada(): void {
    if (sinMovimiento()) return;
    const r = this.raiz;
    const t = gsap.timeline({ defaults: { ease: 'power3.out' } });
    t.fromTo(r.querySelector('.lp-estado'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, clearProps: 'all' })
      .fromTo(r.querySelector('.lp h1'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.6, clearProps: 'all' }, '-=0.2')
      .fromTo(r.querySelectorAll('.lp-sub, .lp-botones, .lp-datos li'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, clearProps: 'all' }, '-=0.3')
      .fromTo(r.querySelectorAll('.lp-foto'), { opacity: 0, scale: 0.8, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'back.out(1.5)' }, 0.2);
    // Las fotos y los círculos de fondo flotan despacio.
    this.flotando = gsap.to(r.querySelectorAll('.lp-foto'), { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.5, from: 'start' } });
    gsap.to(r.querySelectorAll('.lp-blob'), { x: 30, y: -20, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.5 });
  }

  protected irAlMenu(): void {
    document.getElementById('menu')?.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
  }

  protected secciones = computed<Seccion[]>(() => {
    const c = this.estado.catalogo();
    if (!c) return [];
    const out: Seccion[] = c.categorias
      .map((cat) => ({ id: String(cat.id), nombre: cat.nombre, productos: c.productos.filter((p) => p.categoriaId === cat.id) }))
      .filter((s) => s.productos.length);
    const sueltos = c.productos.filter((p) => p.categoriaId == null || !c.categorias.some((x) => x.id === p.categoriaId));
    if (sueltos.length) out.push({ id: 'otros', nombre: out.length ? 'Otros' : 'Nuestros productos', productos: sueltos });
    return out;
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
