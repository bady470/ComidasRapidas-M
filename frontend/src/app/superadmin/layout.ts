import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlataformaApi } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { SesionSuperadmin } from '../core/sesion';
import { Tema } from '../core/tema';

@Component({
  selector: 'app-super-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <div class="wrap">
        <a class="brand" routerLink="/superadmin"><b>Leinei <span class="muted" style="font-family:var(--body);font-weight:600">· superadmin</span></b></a>
        <span class="muted">{{ sesion.actual()?.nombre }}</span>
        <button class="btn" (click)="salir()">Salir</button>
      </div>
    </header>
    <main class="wrap">
      <nav class="tabs" aria-label="Secciones del superadmin" style="margin-top:14px">
        <a routerLink="empresas" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Empresas</a>
        <a routerLink="empresas/nueva" routerLinkActive="activo">Nueva empresa</a>
        <a routerLink="cuenta" routerLinkActive="activo">Mi cuenta</a>
      </nav>
      <router-outlet />
    </main>
  `,
})
export class SuperLayout {
  protected sesion = inject(SesionSuperadmin);
  private api = inject(PlataformaApi);
  private router = inject(Router);

  constructor() {
    const emp = inject(EmpresaActual);
    if (!emp.dominioPropio()) emp.fijar('');
    inject(Tema).restablecer();
  }

  protected salir(): void {
    this.api.logout().subscribe({ complete: () => this.terminar(), error: () => this.terminar() });
  }

  private terminar(): void {
    this.sesion.cerrar();
    this.router.navigateByUrl('/superadmin/entrar');
  }
}
