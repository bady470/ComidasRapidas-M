import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { EstadoTienda } from '../core/estado-tienda';
import { DiaCortoPipe, DineroPipe } from '../core/formato';
import { Produccion } from '../core/modelos';

/** Ventas del día: qué preparar, cuánto se vendió, cuánto se ganó y qué falta por cobrar. */
@Component({
  selector: 'app-produccion',
  imports: [FormsModule, DineroPipe, DiaCortoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <select aria-label="Día" [ngModel]="fecha()" (ngModelChange)="elegir($event)">
        @for (f of fechas(); track f) { <option [value]="f">{{ f | diaCorto }}</option> }
      </select>
      <span class="muted">Sin contar pedidos cancelados</span>
    </div>
    @if (error()) { <div class="alerta mala">{{ error() }}</div> }

    @if (datos(); as d) {
      <div class="kpis num">
        <div class="kpi"><div class="lbl">Pedidos</div><div class="v">{{ d.pedidos }}</div>
          <div class="muted">{{ d.domicilio }} a domicilio · {{ d.recoger }} para recoger</div></div>
        <div class="kpi"><div class="lbl">Unidades vendidas</div><div class="v">{{ d.unidades }}</div></div>
        <div class="kpi"><div class="lbl">Ventas de productos</div><div class="v">{{ d.ventasProductos | dinero }}</div></div>
        <div class="kpi"><div class="lbl">Ganancia estimada</div><div class="v ok">{{ d.ganancia | dinero }}</div></div>
        <div class="kpi"><div class="lbl">Falta por cobrar</div><div class="v">{{ d.porCobrar | dinero }}</div></div>
      </div>
      <div class="two">
        <div class="panel">
          <h3>Qué preparar</h3>
          @if (d.productos.length) {
            <div class="tablewrap"><table class="num">
              <thead><tr><th>Producto</th><th class="r">Unidades</th><th class="r">Ventas</th><th class="r">Ganancia</th></tr></thead>
              <tbody>
                @for (l of d.productos; track l.nombre) {
                  <tr><td>{{ l.nombre }}</td><td class="r"><b>{{ l.unidades }}</b></td><td class="r">{{ l.ventas | dinero }}</td><td class="r">{{ l.ganancia | dinero }}</td></tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="muted">No hay pedidos para este día todavía.</p> }
          @if (d.detalle.length) {
            <span class="sec-titulo">Con opciones</span>
            <div class="tablewrap"><table class="num" style="min-width:360px">
              <tbody>
                @for (l of d.detalle; track $index) {
                  <tr><td>{{ l.nombre }} <span class="muted">— {{ l.detalle }}</span></td><td class="r"><b>{{ l.unidades }}</b></td></tr>
                }
              </tbody>
            </table></div>
          }
          <p class="muted">Costo de productos: {{ d.costoProductos | dinero }}.
            @if (d.costoOperativo) { Gastos operativos: {{ d.costoOperativo | dinero }}. }
            Los domicilios ({{ d.domicilios | dinero }}) no cuentan como ganancia.</p>
        </div>
        <div class="panel">
          <h3>Pagos por cuenta</h3>
          @if (d.pagos.length) {
            <div class="tablewrap"><table class="num">
              <thead><tr><th>Cuenta</th><th class="r">Pedidos</th><th class="r">Total</th><th class="r">Recibido</th></tr></thead>
              <tbody>
                @for (p of d.pagos; track p.cuenta) {
                  <tr><td>{{ p.cuenta }}</td><td class="r">{{ p.pedidos }}</td><td class="r">{{ p.total | dinero }}</td><td class="r">{{ p.recibido | dinero }}</td></tr>
                }
              </tbody>
            </table></div>
          } @else { <p class="muted">Aún no hay pagos.</p> }
        </div>
      </div>
    }
  `,
})
export class ProduccionPage {
  private api = inject(AdminApi);
  private estado = inject(EstadoTienda);
  protected fechas = signal<string[]>([]);
  protected fecha = signal('');
  protected datos = signal<Produccion | null>(null);
  protected error = signal('');

  constructor() {
    effect(() => {
      const hoy = this.estado.catalogo()?.tienda.fechaServicio;
      if (!hoy || this.fecha()) return;
      untracked(() => this.api.fechas().subscribe((f) => {
        this.fechas.set([...new Set([hoy, ...f])].sort().reverse());
        this.elegir(hoy);
      }));
    });
  }

  protected elegir(f: string): void {
    this.fecha.set(f);
    this.api.produccion(f).subscribe({
      next: (d) => { this.datos.set(d); this.error.set(''); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }
}
