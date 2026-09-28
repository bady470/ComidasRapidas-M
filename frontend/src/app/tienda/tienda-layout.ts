import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Logo } from '../compartido/logo';
import { Carrito } from '../core/carrito';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe } from '../core/formato';

@Component({
  selector: 'app-tienda-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CelularPipe, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <div class="wrap">
        <a class="brand" routerLink="/">
          <app-logo [logoId]="tienda()?.logoId ?? null" [nombre]="tienda()?.nombre ?? ''" />
          <b>{{ tienda()?.nombre }}</b>
        </a>
        <nav class="nav" aria-label="Secciones">
          <a routerLink="/" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Menú</a>
          <a routerLink="/seguimiento" routerLinkActive="activo">Mi pedido</a>
        </nav>
        <a class="pillbtn escritorio" routerLink="/carrito">Carrito <span class="pill num">{{ carrito.totalUnidades() }}</span></a>
      </div>
    </header>

    <router-outlet />

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
  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);

  ngOnInit(): void {
    if (!this.estado.catalogo()) this.estado.cargar();
  }
}
