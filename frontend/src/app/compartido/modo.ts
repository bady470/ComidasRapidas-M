import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Modo } from '../core/modo';
import { Icono } from './icono';

/** Botón para cambiar entre modo claro y oscuro. */
@Component({
  selector: 'app-modo',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="modo-btn" (click)="modo.alternar()" [attr.aria-pressed]="modo.actual() === 'oscuro'"
      [attr.aria-label]="modo.actual() === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      [title]="modo.actual() === 'oscuro' ? 'Modo claro' : 'Modo oscuro'">
      <app-icono [nombre]="modo.actual() === 'oscuro' ? 'sol' : 'luna'" />
    </button>
  `,
  styles: `
    .modo-btn { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line);
      background: var(--surface); color: var(--ink-2); padding: 0; transition: color .15s, border-color .15s, background .15s; }
    .modo-btn:hover { color: var(--brand); border-color: var(--brand); }
  `,
})
export class BotonModo {
  protected modo = inject(Modo);
}
