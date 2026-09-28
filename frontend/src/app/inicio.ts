import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EmpresaActual, identificadorValido } from './core/empresa';
import { Tema } from './core/tema';

/** Página de inicio de la plataforma (fuera de cualquier tienda). */
@Component({
  selector: 'app-inicio',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="inicio">
      <form class="panel" (ngSubmit)="ir()">
        <h1 style="font-size:34px">Leinei</h1>
        <p class="muted">Tiendas en línea y portal de pedidos para cada negocio. Escribe el identificador de la tienda a la que quieres entrar.</p>
        <div class="field"><label for="tienda">Tienda</label>
          <input id="tienda" name="tienda" autocomplete="off" placeholder="ej. la-parrilla" [(ngModel)]="tienda"></div>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <button class="primary" type="submit">Ir a la tienda</button>
        <a class="linkbtn" routerLink="/superadmin">Administrar la plataforma</a>
      </form>
    </main>
  `,
})
export class InicioPage {
  private router = inject(Router);
  protected tienda = '';
  protected error = signal('');

  constructor() {
    inject(EmpresaActual).fijar('');
    inject(Tema).restablecer();
  }

  protected ir(): void {
    const slug = this.tienda.trim().toLowerCase();
    if (!identificadorValido(slug)) { this.error.set('Ese identificador no es válido.'); return; }
    this.router.navigateByUrl('/' + slug);
  }
}
