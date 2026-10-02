import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { ModuloPlataforma, Plan } from '../core/modelos';

type Filtro = 'TODOS' | 'PLAN' | 'EXTRA';

/**
 * Lista de módulos de una empresa. Se filtra por lo que trae el plan elegido:
 * «Del plan» (incluidos en el plan), «Extras» (fuera del plan, que se pueden activar aparte) o todos.
 */
@Component({
  selector: 'app-selector-modulos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barra">
      <div class="filtros" role="group" aria-label="Filtrar módulos">
        @for (f of filtros; track f.id) {
          <button type="button" [attr.aria-pressed]="filtro() === f.id" (click)="filtro.set(f.id)">{{ f.texto }} <span class="n">{{ cuenta(f.id) }}</span></button>
        }
      </div>
      @if (plan(); as p) {
        <button type="button" class="linkbtn" [disabled]="igualAlPlan()" (click)="alPlan()">Restablecer al plan {{ p.nombre }}</button>
      }
    </div>
    <div class="modulos">
      @for (m of visibles(); track m.codigo) {
        <label [class.fuera]="!m.esBase && !enPlan(m) ">
          <input type="checkbox" [name]="'m-' + m.codigo" [checked]="activo(m)" [disabled]="m.esBase" (change)="alternar(m.codigo)">
          <b>{{ m.nombre }}
            @if (m.esBase) { <span class="et base">Siempre</span> }
            @else if (plan()) { <span class="et" [class.plan]="enPlan(m)" [class.extra]="!enPlan(m)">{{ enPlan(m) ? 'En el plan' : 'Extra' }}</span> }
          </b>
          <span class="muted">{{ m.descripcion }}</span>
        </label>
      } @empty {
        <span class="muted">No hay módulos en este filtro.</span>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    .barra { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; }
    .filtros { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; padding: 2px; background: var(--surface-2); gap: 2px; }
    .filtros button { border: 0; background: none; padding: 5px 12px; font-weight: 600; font-size: 13px; border-radius: 4px; color: var(--ink-2); cursor: pointer; }
    .filtros button[aria-pressed=true] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
    .n { color: var(--ink-3); font-weight: 500; margin-left: 2px; }
    .et { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px; margin-left: 6px; vertical-align: 1px; }
    .et.plan { background: #f6ffed; color: #389e0d; }
    .et.extra { background: #fffbe6; color: #d48806; }
    .et.base { background: var(--surface-2); color: var(--ink-3); }
    label.fuera { border-style: dashed; }
  `,
})
export class SelectorModulos {
  readonly modulos = input.required<ModuloPlataforma[]>();
  readonly elegidos = model(new Set<string>());
  readonly plan = input<Plan | null>(null);

  protected readonly filtro = signal<Filtro>('TODOS');
  protected readonly filtros: { id: Filtro; texto: string }[] = [
    { id: 'TODOS', texto: 'Todos' }, { id: 'PLAN', texto: 'Del plan' }, { id: 'EXTRA', texto: 'Extras' },
  ];

  protected enPlan(m: ModuloPlataforma): boolean { return m.esBase || !!this.plan()?.modulos.includes(m.codigo); }
  protected activo(m: ModuloPlataforma): boolean { return m.esBase || this.elegidos().has(m.codigo); }

  protected visibles = computed(() => {
    const f = this.filtro();
    if (!this.plan() || f === 'TODOS') return this.modulos();
    return this.modulos().filter((m) => (f === 'PLAN') === this.enPlan(m));
  });

  protected cuenta(f: Filtro): number {
    if (!this.plan() || f === 'TODOS') return this.modulos().length;
    return this.modulos().filter((m) => (f === 'PLAN') === this.enPlan(m)).length;
  }

  protected igualAlPlan = computed(() => {
    const p = this.plan();
    if (!p) return true;
    return this.modulos().every((m) => m.esBase || this.elegidos().has(m.codigo) === p.modulos.includes(m.codigo));
  });

  protected alPlan(): void { this.elegidos.set(new Set(this.plan()?.modulos ?? [])); }

  protected alternar(codigo: string): void {
    const s = new Set(this.elegidos());
    if (s.has(codigo)) s.delete(codigo); else s.add(codigo);
    this.elegidos.set(s);
  }
}
