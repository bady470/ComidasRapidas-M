import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { Superadmin } from '../core/modelos';

/** Clave del superadmin y demás superadmins de la plataforma. */
@Component({
  selector: 'app-cuenta',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="two" style="margin-bottom:40px">
      <form class="panel" (ngSubmit)="cambiarClave(fk)" #fk="ngForm">
        <h3>Cambiar mi clave</h3>
        <div class="field"><label for="kActual">Clave actual</label><input id="kActual" name="kActual" type="password" autocomplete="current-password" [(ngModel)]="clave.actual"></div>
        <div class="field"><label for="kNueva">Clave nueva <span class="hint">(mínimo 10 caracteres)</span></label><input id="kNueva" name="kNueva" type="password" autocomplete="new-password" [(ngModel)]="clave.nueva"></div>
        @if (errorClave()) { <p class="err">{{ errorClave() }}</p> }
        <div><button class="btn main" type="submit">Cambiar clave</button></div>
      </form>

      <form class="panel" (ngSubmit)="crear(fs)" #fs="ngForm">
        <h3>Superadmins</h3>
        <p class="muted">Pueden crear y administrar todas las empresas.</p>
        @for (s of superadmins(); track s.uuid) { <div class="row"><b>{{ s.nombre }}</b><span class="muted">usuario {{ s.usuario }}</span></div> }
        <div class="row2">
          <div class="field"><label for="sNombre">Nombre</label><input id="sNombre" name="sNombre" [(ngModel)]="nuevo.nombre"></div>
          <div class="field"><label for="sUsuario">Usuario</label><input id="sUsuario" name="sUsuario" autocomplete="off" [(ngModel)]="nuevo.usuario"></div>
        </div>
        <div class="field"><label for="sClave">Clave <span class="hint">(mínimo 10 caracteres)</span></label><input id="sClave" name="sClave" type="password" autocomplete="new-password" [(ngModel)]="nuevo.clave"></div>
        @if (errorNuevo()) { <p class="err">{{ errorNuevo() }}</p> }
        <div><button class="btn main" type="submit">Agregar superadmin</button></div>
      </form>
    </div>
  `,
})
export class CuentaPage {
  private api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  protected superadmins = signal<Superadmin[]>([]);
  protected clave = { actual: '', nueva: '' };
  protected nuevo = { nombre: '', usuario: '', clave: '' };
  protected errorClave = signal('');
  protected errorNuevo = signal('');

  constructor() {
    this.api.superadmins().subscribe({ next: (l) => this.superadmins.set(l), error: (e) => this.errorNuevo.set(mensajeError(e)) });
  }

  protected cambiarClave(form: NgForm): void {
    if (!this.clave.actual || this.clave.nueva.length < 10) { this.errorClave.set('Escribe la clave actual y una nueva de al menos 10 caracteres.'); return; }
    this.api.cambiarClave(this.clave.actual, this.clave.nueva).subscribe({
      next: () => { form.resetForm(); this.clave = { actual: '', nueva: '' }; this.errorClave.set(''); this.avisos.mostrar('Clave cambiada'); },
      error: (e) => this.errorClave.set(mensajeError(e)),
    });
  }

  protected crear(form: NgForm): void {
    const n = this.nuevo;
    if (!n.nombre.trim() || !n.usuario.trim() || n.clave.length < 10) {
      this.errorNuevo.set('Escribe nombre, usuario y una clave de al menos 10 caracteres.');
      return;
    }
    this.api.crearSuperadmin(n.usuario.trim(), n.nombre.trim(), n.clave).subscribe({
      next: (s) => {
        this.superadmins.update((l) => [...l, s]);
        form.resetForm();
        this.nuevo = { nombre: '', usuario: '', clave: '' };
        this.errorNuevo.set('');
        this.avisos.mostrar(`${s.nombre} ya puede entrar como superadmin`);
      },
      error: (e) => this.errorNuevo.set(mensajeError(e)),
    });
  }
}
