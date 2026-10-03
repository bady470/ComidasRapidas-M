import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Icono } from '../compartido/icono';
import { GrupoMenu, Shell } from '../compartido/shell';
import { PlataformaApi } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { ResumenPlataforma } from '../core/modelos';
import { SesionSuperadmin } from '../core/sesion';
import { Tema } from '../core/tema';
import { enVivoPlataforma } from './en-vivo';

/**
 * Marco del superadmin. El menú va por tareas: lo de todos los días (Panel, Empresas), lo del negocio
 * (planes, cobros, catálogo base) y los ajustes. «Nueva empresa» queda siempre a mano en la barra de arriba.
 */
@Component({
  selector: 'app-super-layout',
  imports: [RouterOutlet, RouterLink, Shell, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell marca="Leinei" subtitulo="Superadministración" [grupos]="menu()" [usuario]="sesion.actual()?.nombre ?? ''"
               rol="Superadmin" inicio="/superadmin" (salir)="salir()">
      <div acciones class="mt-botones">
        <a class="btn main" routerLink="/superadmin/empresas/nueva"><app-icono nombre="mas" /> Nueva empresa</a>
      </div>
      <router-outlet />
    </app-shell>
  `,
})
export class SuperLayout {
  protected sesion = inject(SesionSuperadmin);
  private api = inject(PlataformaApi);
  private router = inject(Router);

  /** Empresas que piden atención (con error o todavía preparándose): se marcan en el menú. */
  private resumen = signal<ResumenPlataforma | null>(null);
  private atencion = computed(() => {
    const r = this.resumen();
    return r ? r.conError + r.enPreparacion : 0;
  });

  protected readonly menu = computed<GrupoMenu[]>(() => [
    { titulo: 'General', items: [
      { ruta: 'panel', texto: 'Panel', icono: 'casa' },
      { ruta: 'empresas', texto: 'Empresas', icono: 'empresas', insignia: this.atencion() ? `${this.atencion()} atención` : null },
    ] },
    { titulo: 'Negocio', items: [
      { ruta: 'planes', texto: 'Planes y precios', icono: 'planes' },
      { ruta: 'pagos', texto: 'Pagos en línea', icono: 'pagos' },
      { ruta: 'biblioteca', texto: 'Productos precargados', icono: 'biblioteca' },
    ] },
    { titulo: 'Ajustes', items: [
      { ruta: 'correo', texto: 'Correo de envío', icono: 'correo' },
      { ruta: 'cuenta', texto: 'Mi cuenta', icono: 'cuenta' },
    ] },
  ]);

  constructor() {
    const emp = inject(EmpresaActual);
    if (!emp.dominioPropio()) emp.fijar('');
    inject(Tema).restablecer();
    this.contar();
    // El aviso del menú se actualiza solo cuando una empresa cambia de estado.
    enVivoPlataforma(() => this.contar());
  }

  private contar(): void {
    this.api.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => { /* sin aviso en el menú */ } });
  }

  protected salir(): void {
    this.api.logout().subscribe({ complete: () => this.terminar(), error: () => this.terminar() });
  }

  private terminar(): void {
    this.sesion.cerrar();
    this.router.navigateByUrl('/superadmin/entrar');
  }
}
