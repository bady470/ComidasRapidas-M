import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlataformaApi, mensajeError } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { SesionSuperadmin } from '../core/sesion';
import { Tema } from '../core/tema';

@Component({
  selector: 'app-super-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="inicio">
      <form class="panel login" (ngSubmit)="entrar()">
        <h1 style="font-size:28px">Superadmin</h1>
        <p class="muted" style="font-size:14px">Administra las empresas de la plataforma: crea tiendas, activa módulos y revisa su estado.</p>
        <div class="field"><label for="usuario">Usuario</label>
          <input id="usuario" name="usuario" autocomplete="username" [(ngModel)]="usuario"></div>
        <div class="field"><label for="clave">Clave</label>
          <input id="clave" name="clave" type="password" autocomplete="current-password" [(ngModel)]="clave"></div>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <button class="primary" type="submit" [disabled]="cargando()">{{ cargando() ? 'Entrando…' : 'Entrar' }}</button>
      </form>
    </main>
  `,
})
export class SuperLoginPage {
  private api = inject(PlataformaApi);
  private sesion = inject(SesionSuperadmin);
  private router = inject(Router);

  protected usuario = '';
  protected clave = '';
  protected cargando = signal(false);
  protected error = signal('');

  constructor() {
    const emp = inject(EmpresaActual);
    if (!emp.dominioPropio()) emp.fijar('');
    inject(Tema).restablecer();
    if (this.sesion.token()) this.router.navigateByUrl('/superadmin');
  }

  protected entrar(): void {
    if (!this.usuario.trim() || !this.clave) { this.error.set('Escribe tu usuario y tu clave.'); return; }
    this.cargando.set(true);
    this.error.set('');
    this.api.login(this.usuario.trim(), this.clave).subscribe({
      next: (s) => { this.sesion.iniciar(s); this.router.navigateByUrl('/superadmin'); },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }
}
