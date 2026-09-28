import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Logo } from '../compartido/logo';
import { AdminApi } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { MODULOS } from '../core/modelos';
import { SesionAdmin } from '../core/sesion';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <div class="wrap">
        <a class="brand" [routerLink]="emp.url('/admin')">
          <app-logo [logoUrl]="tienda()?.logoUrl" [nombre]="tienda()?.nombre ?? ''" />
          <b>{{ tienda()?.nombre }} <span class="muted" style="font-family:var(--body);font-weight:600">· panel</span></b>
        </a>
        <span class="muted">{{ sesion.actual()?.nombre }}</span>
        <a class="btn" [href]="emp.url()" target="_blank" rel="noopener">Ver tienda</a>
        <button class="btn" (click)="salir()">Salir</button>
      </div>
    </header>
    <main class="wrap">
      <nav class="tabs" aria-label="Secciones del panel" style="margin-top:14px">
        <a routerLink="pedidos" routerLinkActive="activo">Pedidos</a>
        @if (estado.tieneModulo(M.reportes)) { <a routerLink="ventas" routerLinkActive="activo">Ventas</a> }
        <a routerLink="productos" routerLinkActive="activo">Productos</a>
        <a routerLink="categorias" routerLinkActive="activo">Categorías</a>
        @if (estado.tieneModulo(M.promociones)) { <a routerLink="promociones" routerLinkActive="activo">Promociones</a> }
        <a routerLink="tienda" routerLinkActive="activo">Mi tienda</a>
      </nav>
      <router-outlet />
    </main>
  `,
})
export class AdminLayout implements OnInit {
  protected sesion = inject(SesionAdmin);
  protected estado = inject(EstadoTienda);
  protected emp = inject(EmpresaActual);
  protected readonly M = MODULOS;
  private api = inject(AdminApi);
  private router = inject(Router);
  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);

  ngOnInit(): void {
    this.estado.asegurar();
  }

  protected salir(): void {
    this.api.logout().subscribe({ complete: () => this.terminar(), error: () => this.terminar() });
  }

  private terminar(): void {
    this.sesion.cerrar();
    this.router.navigateByUrl(this.emp.url('/admin/entrar'));
  }
}
