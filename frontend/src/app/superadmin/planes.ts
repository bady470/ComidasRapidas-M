import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe } from '../core/formato';
import { ModuloPlataforma, Plan } from '../core/modelos';

/** Planes comerciales: precio mensual y anual, y los módulos que incluye cada uno. */
@Component({
  selector: 'app-planes',
  imports: [FormsModule, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel" style="margin-bottom:14px">
      <h3>Planes</h3>
      <p class="muted">Lo que cuesta cada plan, por mes o por año, y qué módulos incluye. Al crear una empresa eliges uno de estos planes; las empresas ya creadas conservan el precio con el que se contrataron.</p>
    </div>

    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    <div class="panel tablewrap tabla-datos" style="padding:0">
      <table style="min-width:900px">
        <thead>
          <tr><th>Plan</th><th class="r">Mensual</th><th class="r">Anual</th><th>Ahorro anual</th><th>Módulos</th><th>Activo</th><th class="r">Acción</th></tr>
        </thead>
        <tbody>
          @for (p of lista(); track p.codigo) {
            <tr [class.apagada]="!p.activo">
              <td style="min-width:200px">
                <input class="celda" [name]="'n' + p.codigo" [(ngModel)]="p.nombre" aria-label="Nombre del plan" style="font-weight:700">
                <input class="celda muted" [name]="'d' + p.codigo" [(ngModel)]="p.descripcion" aria-label="Descripción" placeholder="Descripción corta">
                <span class="muted num">{{ p.codigo }}</span>
              </td>
              <td class="r"><input class="celda num" type="number" min="0" step="1000" [name]="'m' + p.codigo" [(ngModel)]="p.precioMensual" aria-label="Precio mensual" style="width:110px;text-align:right"></td>
              <td class="r"><input class="celda num" type="number" min="0" step="1000" [name]="'a' + p.codigo" [(ngModel)]="p.precioAnual" aria-label="Precio anual" style="width:120px;text-align:right"></td>
              <td class="num">
                @if (ahorro(p) > 0) { <span class="ok-texto">{{ ahorro(p) | dinero }}</span> } @else { <span class="muted">—</span> }
              </td>
              <td>
                <details class="mods">
                  <summary>{{ p.modulos.length }} de {{ modulos().length }}</summary>
                  <div class="mods-lista">
                    @for (m of modulos(); track m.codigo) {
                      <label class="check"><input type="checkbox" [checked]="m.esBase || p.modulos.includes(m.codigo)" [disabled]="m.esBase" (change)="alternar(p, m.codigo)"> {{ m.nombre }}</label>
                    }
                  </div>
                </details>
              </td>
              <td><label class="check"><input type="checkbox" [name]="'x' + p.codigo" [(ngModel)]="p.activo"> {{ p.activo ? 'Sí' : 'No' }}</label></td>
              <td class="r"><button class="btn main" type="button" [disabled]="guardando() === p.codigo" (click)="guardar(p)">{{ guardando() === p.codigo ? 'Guardando…' : 'Guardar' }}</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <form class="panel" style="margin-top:16px;max-width:880px" (ngSubmit)="crear()">
      <h3>Nuevo plan</h3>
      <div class="row2">
        <div class="field"><label for="pnNombre">Nombre</label><input id="pnNombre" name="pnNombre" [(ngModel)]="nuevo.nombre" (ngModelChange)="sugerirCodigo()" placeholder="Ej: Premium"></div>
        <div class="field"><label for="pnCodigo">Código</label><input id="pnCodigo" name="pnCodigo" [(ngModel)]="nuevo.codigo" placeholder="premium"><span class="hint">Minúsculas, números y guiones. No se cambia después.</span></div>
      </div>
      <div class="row2">
        <div class="field"><label for="pnM">Precio mensual</label><input id="pnM" name="pnM" type="number" min="0" step="1000" [(ngModel)]="nuevo.precioMensual"></div>
        <div class="field"><label for="pnA">Precio anual</label><input id="pnA" name="pnA" type="number" min="0" step="1000" [(ngModel)]="nuevo.precioAnual"></div>
      </div>
      <div><button class="btn main" type="submit">Crear plan</button></div>
    </form>
  `,
  styles: `
    .celda { width: 100%; border: 1px solid transparent; background: transparent; padding: 4px 6px; border-radius: 6px; display: block; }
    .celda:hover, .celda:focus { border-color: var(--line); background: var(--surface); }
    .ok-texto { color: var(--ok); font-weight: 600; }
    .mods summary { cursor: pointer; font-weight: 600; }
    .mods-lista { display: grid; gap: 6px; padding: 8px 0; }
  `,
})
export class PlanesPage {
  private api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  protected lista = signal<Plan[]>([]);
  protected modulos = signal<ModuloPlataforma[]>([]);
  protected error = signal('');
  protected guardando = signal('');
  protected nuevo: Plan = { codigo: '', nombre: '', descripcion: '', precioMensual: 0, precioAnual: 0, modulos: ['tienda'], activo: true };
  private codigoTocado = false;

  constructor() {
    this.api.planes().subscribe({ next: (l) => this.lista.set(l), error: (e) => this.error.set(mensajeError(e)) });
    this.api.modulos().subscribe((l) => this.modulos.set(l));
  }

  protected ahorro(p: Plan): number { return Math.max(0, p.precioMensual * 12 - p.precioAnual); }

  protected alternar(p: Plan, codigo: string): void {
    p.modulos = p.modulos.includes(codigo) ? p.modulos.filter((m) => m !== codigo) : [...p.modulos, codigo];
  }

  protected sugerirCodigo(): void {
    if (this.codigoTocado && this.nuevo.codigo) return;
    this.nuevo.codigo = this.nuevo.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  }

  protected guardar(p: Plan): void {
    this.error.set('');
    this.guardando.set(p.codigo);
    const base = this.modulos().filter((m) => m.esBase).map((m) => m.codigo);
    this.api.guardarPlan({ ...p, precioMensual: Number(p.precioMensual) || 0, precioAnual: Number(p.precioAnual) || 0,
      modulos: [...new Set([...base, ...p.modulos])] }).subscribe({
      next: (r) => {
        this.guardando.set('');
        this.lista.update((l) => l.map((x) => (x.codigo === r.codigo ? r : x)));
        this.avisos.mostrar(`Plan ${r.nombre} guardado`);
      },
      error: (e) => { this.guardando.set(''); this.error.set(mensajeError(e)); },
    });
  }

  protected crear(): void {
    this.error.set('');
    const base = this.modulos().filter((m) => m.esBase).map((m) => m.codigo);
    this.api.crearPlan({ ...this.nuevo, precioMensual: Number(this.nuevo.precioMensual) || 0,
      precioAnual: Number(this.nuevo.precioAnual) || 0, modulos: base }).subscribe({
      next: (r) => {
        this.lista.update((l) => [...l, r]);
        this.nuevo = { codigo: '', nombre: '', descripcion: '', precioMensual: 0, precioAnual: 0, modulos: ['tienda'], activo: true };
        this.avisos.mostrar(`Plan ${r.nombre} creado: elige sus módulos en la tabla`);
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }
}
