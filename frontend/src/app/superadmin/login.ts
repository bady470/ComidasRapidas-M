import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Acceso } from '../compartido/acceso';
import { PlataformaApi, mensajeError } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { SesionSuperadmin } from '../core/sesion';
import { Tema } from '../core/tema';

@Component({
  selector: 'app-super-login',
  imports: [RouterLink, Acceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-acceso marca="Leinei" titulo="Superadministración" subtitulo="Entra con tu usuario de superadministrador."
      lema="Administra todas las empresas de la plataforma desde un solo lugar."
      [beneficios]="['Crea tiendas y portales en minutos', 'Planes, módulos y precios por empresa', 'Productos precargados y correo de bienvenida']"
      [error]="error()" [cargando]="cargando()" [(usuario)]="usuario" [(clave)]="clave" (enviar)="entrar()">
      <a class="linkbtn" routerLink="/">← Volver al inicio</a>
    </app-acceso>
  `,
})
export class SuperLoginPage {
  private api = inject(PlataformaApi);
  private sesion = inject(SesionSuperadmin);
  private router = inject(Router);

  protected usuario = signal('');
  protected clave = signal('');
  protected cargando = signal(false);
  protected error = signal('');

  constructor() {
    const emp = inject(EmpresaActual);
    if (!emp.dominioPropio()) emp.fijar('');
    inject(Tema).restablecer();
    if (this.sesion.token()) this.router.navigateByUrl('/superadmin');
  }

  protected entrar(): void {
    if (!this.usuario().trim() || !this.clave()) { this.error.set('Escribe tu usuario y tu clave.'); return; }
    this.cargando.set(true);
    this.error.set('');
    this.api.login(this.usuario().trim(), this.clave()).subscribe({
      next: (s) => { this.sesion.iniciar(s); this.router.navigateByUrl('/superadmin'); },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }
}
