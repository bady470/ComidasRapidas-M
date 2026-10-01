import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { GrupoMenu, Shell } from '../compartido/shell';
import { PlataformaApi } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { SesionSuperadmin } from '../core/sesion';
import { Tema } from '../core/tema';

@Component({
  selector: 'app-super-layout',
  imports: [RouterOutlet, Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell marca="Leinei" subtitulo="Superadministración" [grupos]="menu" [usuario]="sesion.actual()?.nombre ?? ''"
               rol="Superadmin" inicio="/superadmin" (salir)="salir()">
      <router-outlet />
    </app-shell>
  `,
})
export class SuperLayout {
  protected sesion = inject(SesionSuperadmin);
  private api = inject(PlataformaApi);
  private router = inject(Router);

  protected readonly menu: GrupoMenu[] = [
    { titulo: 'Plataforma', items: [
      { ruta: 'empresas', texto: 'Empresas', icono: 'empresas', exacto: true },
      { ruta: 'empresas/nueva', texto: 'Nueva empresa', icono: 'nueva' },
      { ruta: 'planes', texto: 'Planes y precios', icono: 'planes' },
      { ruta: 'biblioteca', texto: 'Productos precargados', icono: 'biblioteca' },
    ] },
    { titulo: 'Ajustes', items: [
      { ruta: 'correo', texto: 'Correo de envío', icono: 'correo' },
      { ruta: 'cuenta', texto: 'Mi cuenta', icono: 'cuenta' },
    ] },
  ];

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
