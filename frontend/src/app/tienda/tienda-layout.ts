import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { BotonModo } from '../compartido/modo';
import { Icono } from '../compartido/icono';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CarritoFlotante } from '../compartido/carrito-flotante';
import { SelectorSede } from '../compartido/selector-sede';
import { AvisoCerrado } from '../compartido/aviso-cerrado';
import { Logo } from '../compartido/logo';
import { Carrito } from '../core/carrito';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe, soloHora } from '../core/formato';

@Component({
  selector: 'app-tienda-layout',
  imports: [Icono, BotonModo, RouterOutlet, RouterLink, RouterLinkActive, CelularPipe, Logo, CarritoFlotante, SelectorSede, AvisoCerrado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'tienda pl-' + estado.plantilla().toLowerCase()" },
  template: `
    <header class="top">
      <div class="wrap">
        <a class="brand" [routerLink]="emp.url()">
          <app-logo [logoUrl]="tienda()?.logoUrl" [nombre]="tienda()?.nombre ?? ''" />
          <b>{{ tienda()?.nombre }}</b>
        </a>
        <nav class="nav" aria-label="Secciones">
          <a [routerLink]="emp.url()" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Menú</a>
          <a [routerLink]="emp.url('/seguimiento')" routerLinkActive="activo">Mi pedido</a>
        </nav>
        <app-selector-sede />
        <app-modo />
      </div>
    </header>

    @if (tienda(); as t) {
      @let s = t.saturacion;
      @if (s.pedidosPausadosHasta || s.domiciliosPausadosHasta || s.minutosExtra) {
        <div class="aviso-demanda" role="status"><div class="wrap">
          <app-icono nombre="llama" />
          @if (s.pedidosPausadosHasta) { Estamos a tope de pedidos. Volvemos a recibir a las {{ hora(s.pedidosPausadosHasta) }}. }
          @else if (s.domiciliosPausadosHasta) { Pausamos los domicilios hasta las {{ hora(s.domiciliosPausadosHasta) }}.{{ t.recogerActivo ? ' Puedes pedir para recoger en el local.' : '' }} }
          @else { Hay mucha demanda: tu pedido puede tardar {{ t.tiempoMin }}–{{ t.tiempoMax }} minutos. }
        </div></div>
      }
    }

    <router-outlet />

    <!-- Carrito flotante: siempre en el menú; en las demás páginas, solo si hay algo. Nunca en la página del carrito. -->
    <!-- Fuera del horario: modal con cuándo abren y el horario (solo en el menú y el carrito). -->
    <app-aviso-cerrado [activo]="enMenu() || enCarrito()" />

    <app-carrito-flotante [visible]="!enCarrito() && (enMenu() || carrito.totalUnidades() > 0)" />

    @if (tienda(); as t) {
      <footer class="site">
        <div class="wrap stack" style="gap:4px">
          <b style="color:var(--ink-2)">{{ t.nombre }}</b>
          @if (t.eslogan) { <span>{{ t.eslogan }}</span> }
          <span>
            @if (t.direccion) { {{ t.direccion }}{{ t.ciudad ? ', ' + t.ciudad : '' }} · }
            @if (t.whatsapp) { WhatsApp <span class="num">{{ t.whatsapp | celular }}</span> }
            @if (t.instagram) { · <a [href]="'https://instagram.com/' + t.instagram" target="_blank" rel="noopener">&#64;{{ t.instagram }}</a> }
          </span>
        </div>
      </footer>
    }
  `,
})
export class TiendaLayout implements OnInit {
  protected estado = inject(EstadoTienda);
  protected carrito = inject(Carrito);
  protected emp = inject(EmpresaActual);
  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);

  private router = inject(Router);
  private ruta = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url });
  private camino = computed(() => this.ruta().split(/[?#]/)[0]!.replace(/\/+$/, ''));
  protected enCarrito = computed(() => this.camino().endsWith('/carrito'));
  protected enMenu = computed(() => this.camino() === this.emp.url().replace(/\/+$/, ''));

  protected hora(iso: string): string { return soloHora(iso); }

  ngOnInit(): void {
    this.estado.asegurar();
  }
}
