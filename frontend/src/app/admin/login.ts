import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi, mensajeError } from '../core/api';
import { SesionAdmin } from '../core/sesion';
import { EstadoTienda } from '../core/estado-tienda';
import { EmpresaActual } from '../core/empresa';
import { Logo } from '../compartido/logo';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <form class="panel login" (ngSubmit)="entrar()">
        <app-logo [logoUrl]="estado.catalogo()?.tienda?.logoUrl" [nombre]="estado.catalogo()?.tienda?.nombre ?? ''" style="width:52px;height:52px;border-radius:14px" />
        <h1 style="font-size:28px">Panel de {{ estado.catalogo()?.tienda?.nombre ?? 'tu tienda' }}</h1>
        <p class="muted" style="font-size:14px">Entra con tu usuario de administrador para ver pedidos y manejar la tienda.</p>
        <div class="field"><label for="usuario">Usuario</label>
          <input id="usuario" name="usuario" autocomplete="username" [(ngModel)]="usuario"></div>
        <div class="field"><label for="clave">Clave</label>
          <input id="clave" name="clave" type="password" autocomplete="current-password" [(ngModel)]="clave"></div>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        @if (estado.error() && !estado.catalogo()) { <p class="err" role="alert">{{ estado.error() }}</p> }
        <button class="primary" type="submit" [disabled]="cargando()">{{ cargando() ? 'Entrando…' : 'Entrar' }}</button>
        <a class="linkbtn" [routerLink]="emp.url()">Ir a la tienda</a>
      </form>
    </main>
  `,
})
export class LoginPage {
  private api = inject(AdminApi);
  private sesion = inject(SesionAdmin);
  private router = inject(Router);
  protected estado = inject(EstadoTienda);
  protected emp = inject(EmpresaActual);

  protected usuario = '';
  protected clave = '';
  protected cargando = signal(false);
  protected error = signal('');

  constructor() {
    this.estado.asegurar();
    if (this.sesion.token()) this.router.navigateByUrl(this.emp.url('/admin'));
  }

  protected entrar(): void {
    if (!this.usuario.trim() || !this.clave) { this.error.set('Escribe tu usuario y tu clave.'); return; }
    this.cargando.set(true);
    this.error.set('');
    this.api.login(this.usuario.trim(), this.clave).subscribe({
      next: (s) => { this.sesion.iniciar(s); this.router.navigateByUrl(this.emp.url('/admin/pedidos')); },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }
}
