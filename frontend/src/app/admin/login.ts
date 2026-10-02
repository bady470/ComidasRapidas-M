import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi, mensajeError } from '../core/api';
import { SesionAdmin } from '../core/sesion';
import { EstadoTienda } from '../core/estado-tienda';
import { EmpresaActual } from '../core/empresa';
import { Acceso } from '../compartido/acceso';

@Component({
  selector: 'app-login',
  imports: [RouterLink, Acceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-acceso [marca]="estado.catalogo()?.tienda?.nombre ?? 'Tu tienda'" [logoUrl]="estado.catalogo()?.tienda?.logoUrl"
      titulo="Portal de pedidos" subtitulo="Entra con tu usuario de administrador."
      lema="Atiende los pedidos de tu tienda en tiempo real."
      [beneficios]="['Pedidos y pagos al instante', 'Productos, precios y promociones', 'Domiciliarios y reportes']"
      [error]="error() || (estado.error() && !estado.catalogo() ? estado.error() : '')" [cargando]="cargando()"
      [(usuario)]="usuario" [(clave)]="clave" (enviar)="entrar()">
      <a class="linkbtn" [routerLink]="emp.url()">← Ir a la tienda</a>
    </app-acceso>
  `,
})
export class LoginPage {
  private api = inject(AdminApi);
  private sesion = inject(SesionAdmin);
  private router = inject(Router);
  protected estado = inject(EstadoTienda);
  protected emp = inject(EmpresaActual);

  protected usuario = signal('');
  protected clave = signal('');
  protected cargando = signal(false);
  protected error = signal('');

  constructor() {
    this.estado.asegurar();
    if (this.sesion.token()) this.router.navigateByUrl(this.emp.url('/admin'));
  }

  protected entrar(): void {
    if (!this.usuario().trim() || !this.clave()) { this.error.set('Escribe tu usuario y tu clave.'); return; }
    this.cargando.set(true);
    this.error.set('');
    this.api.login(this.usuario().trim(), this.clave()).subscribe({
      next: (s) => { this.sesion.iniciar(s); this.router.navigateByUrl(this.emp.url('/admin/pedidos')); },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }
}
