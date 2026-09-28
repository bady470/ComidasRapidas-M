import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Logo } from '../compartido/logo';
import { AdminApi } from '../core/api';
import { EstadoTienda } from '../core/estado-tienda';
import { SesionAdmin } from '../core/sesion';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <div class="wrap">
        <a class="brand" routerLink="/admin">
          <app-logo [logoId]="tienda()?.logoId ?? null" [nombre]="tienda()?.nombre ?? ''" />
          <b>{{ tienda()?.nombre }} <span class="muted" style="font-family:var(--body);font-weight:600">· panel</span></b>
        </a>
        <span class="muted">{{ sesion.actual()?.nombre }}</span>
        <a class="btn" routerLink="/" target="_blank">Ver tienda</a>
        <button class="btn" (click)="salir()">Salir</button>
      </div>
    </header>
    <main class="wrap">
      <nav class="tabs" aria-label="Secciones del panel" style="margin-top:14px">
        <a routerLink="pedidos" routerLinkActive="activo">Pedidos</a>
        <a routerLink="ventas" routerLinkActive="activo">Ventas</a>
        <a routerLink="productos" routerLinkActive="activo">Productos</a>
        <a routerLink="categorias" routerLinkActive="activo">Categorías</a>
        <a routerLink="promociones" routerLinkActive="activo">Promociones</a>
        <a routerLink="tienda" routerLinkActive="activo">Mi tienda</a>
      </nav>
      <router-outlet />
    </main>
  `,
})
export class AdminLayout implements OnInit {
  protected sesion = inject(SesionAdmin);
  private estado = inject(EstadoTienda);
  private api = inject(AdminApi);
  private router = inject(Router);
  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);

  ngOnInit(): void {
    if (!this.estado.catalogo()) this.estado.cargar();
  }

  protected salir(): void {
    this.api.logout().subscribe({ complete: () => this.terminar(), error: () => this.terminar() });
  }

  private terminar(): void {
    this.sesion.cerrar();
    this.router.navigate(['/admin/entrar']);
  }
}
