import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Foto } from '../compartido/foto';
import { SelectorProducto, Seleccion } from '../compartido/selector-producto';
import { Avisos } from '../core/avisos';
import { Carrito } from '../core/carrito';
import { EstadoTienda } from '../core/estado-tienda';
import { DiaLargoPipe, DineroPipe, cuando, etiquetaPromo } from '../core/formato';
import { Producto, Promocion } from '../core/modelos';

interface Seccion { id: string; nombre: string; productos: Producto[]; }

@Component({
  selector: 'app-catalogo',
  imports: [RouterLink, Foto, SelectorProducto, DineroPipe, DiaLargoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      @if (estado.error() && !estado.catalogo()) {
        <div class="empty" style="margin-top:28px">
          <p>{{ estado.error() }}</p>
          <p style="margin-top:12px"><button class="ghost" (click)="estado.cargar()">Intentar de nuevo</button></p>
        </div>
      }

      @if (estado.catalogo(); as c) {
        <section class="hero">
          <div>
            <h1>{{ c.tienda.tituloPortada || c.tienda.nombre }}</h1>
            @if (c.tienda.mensaje) { <p>{{ c.tienda.mensaje }}</p> }
          </div>
          <div class="delivery">
            @if (c.tienda.modoPedido === 'PROGRAMADO') {
              <span class="lbl">Próxima entrega</span>
              <span class="when">{{ c.tienda.fechaServicio | diaLargo }}</span>
              @if (c.tienda.cierre) { <span class="muted">Pide hasta {{ texto(c.tienda.cierre) }}</span> }
            } @else if (c.tienda.enHorario) {
              <span class="estado-tienda abierta">Abierto ahora</span>
              <span class="when">Entrega en {{ c.tienda.tiempoMin }}–{{ c.tienda.tiempoMax }} min</span>
              @if (c.tienda.cierre) { <span class="muted">Recibimos pedidos hasta {{ texto(c.tienda.cierre) }}</span> }
            } @else {
              <span class="estado-tienda cerrada">Cerrado</span>
              <span class="when">{{ c.tienda.proximaApertura ? 'Abrimos ' + texto(c.tienda.proximaApertura) : 'Vuelve pronto' }}</span>
              <span class="muted">Puedes ver el menú mientras tanto.</span>
            }
            <span class="muted">{{ entrega() }}</span>
          </div>
        </section>

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
      } @else if (!estado.error()) {
        <p class="muted" style="padding-block:40px">Cargando…</p>
      }
    </main>

    @if (abierto(); as p) {
      <app-selector-producto [producto]="p" (elegido)="agregar($event)" (cerrar)="abierto.set(null)" />
    }

    @if (carrito.totalUnidades()) {
      <div class="cartbar">
        <a routerLink="/carrito"><span>Ver carrito · {{ carrito.totalUnidades() }} {{ carrito.totalUnidades() === 1 ? 'producto' : 'productos' }}</span><span>Pedir</span></a>
      </div>
    }
  `,
})
export class CatalogoPage {
  protected estado = inject(EstadoTienda);
  protected carrito = inject(Carrito);
  private avisos = inject(Avisos);

  protected abierto = signal<Producto | null>(null);
  protected activa = signal('');

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
