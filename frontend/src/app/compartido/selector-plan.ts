import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DineroPipe } from '../core/formato';
import { CicloFacturacion, Plan } from '../core/modelos';

/** Elige el plan y si se cobra mensual o anual. Muestra el precio de cada plan según el ciclo. */
@Component({
  selector: 'app-selector-plan',
  imports: [DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ciclo" role="group" aria-label="Facturación">
      <button type="button" [attr.aria-pressed]="ciclo() === 'MENSUAL'" (click)="ciclo.set('MENSUAL')">Mensual</button>
      <button type="button" [attr.aria-pressed]="ciclo() === 'ANUAL'" (click)="ciclo.set('ANUAL')">Anual</button>
    </div>
    <div class="planes">
      @for (p of planes(); track p.codigo) {
        <button type="button" class="plan" [attr.aria-pressed]="plan() === p.codigo" (click)="elegir(p)">
          <span class="plan-nombre">{{ p.nombre }}@if (!p.activo) { <small> · desactivado</small> }</span>
          <span class="plan-precio num">{{ precio(p) | dinero }}<small> / {{ ciclo() === 'ANUAL' ? 'año' : 'mes' }}</small></span>
          @if (ciclo() === 'ANUAL' && ahorro(p) > 0) { <span class="plan-ahorro">Ahorras {{ ahorro(p) | dinero }} al año</span> }
          <span class="muted">{{ p.descripcion }}</span>
        </button>
      } @empty {
        <span class="muted">No hay planes activos. Créalos en «Planes».</span>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .ciclo { display: inline-flex; width: fit-content; border: 1px solid var(--line); border-radius: 6px; padding: 2px; background: var(--surface-2); gap: 2px; }
    .ciclo button { border: 0; background: none; padding: 6px 16px; font-weight: 600; border-radius: 4px; color: var(--ink-2); }
    .ciclo button[aria-pressed=true] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
    .planes { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
    .plan { display: grid; gap: 4px; text-align: left; align-content: start; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 12px 14px; }
    .plan:hover { border-color: color-mix(in srgb, var(--brand) 50%, var(--line)); }
    .plan[aria-pressed=true] { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand); background: var(--accent-soft); }
    .plan-nombre { font-weight: 700; font-size: 15px; }
    .plan-precio { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
    .plan-precio small, .plan-nombre small { font-size: 12px; font-weight: 500; color: var(--ink-3); }
    .plan-ahorro { font-size: 12px; font-weight: 600; color: var(--ok); }
  `,
})
export class SelectorPlan {
  readonly planes = input.required<Plan[]>();
  readonly plan = model('');
  readonly ciclo = model<CicloFacturacion>('MENSUAL');
  readonly elegido = output<Plan>();

  protected precio(p: Plan): number { return this.ciclo() === 'ANUAL' ? p.precioAnual : p.precioMensual; }
  protected ahorro(p: Plan): number { return Math.max(0, p.precioMensual * 12 - p.precioAnual); }
  protected elegir(p: Plan): void { this.plan.set(p.codigo); this.elegido.emit(p); }
}
