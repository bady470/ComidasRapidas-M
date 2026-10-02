import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EmpresaActual } from '../core/empresa';
import { DiaLargoPipe, DineroPipe, HoraPipe, diaCorto } from '../core/formato';
import { Caja, CierreCajaForm, NOMBRE_ESTADO, NOMBRE_PAGO } from '../core/modelos';

/**
 * Cierre de caja del día: cuánto entró por cada medio, qué falta por cobrar, cuánto efectivo debe traer cada
 * domiciliario y el cuadre del efectivo (base + recibido − gastos contra lo que se contó).
 */
@Component({
  selector: 'app-caja',
  imports: [FormsModule, RouterLink, DineroPipe, DiaLargoPipe, HoraPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h">
      <h1>Cierre de caja</h1>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input type="date" aria-label="Día" [ngModel]="fecha()" (ngModelChange)="cambiarFecha($event)" style="width:auto">
      </div>
    </div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (caja(); as c) {
      <p class="muted" style="margin:-6px 0 12px">{{ c.fecha | diaLargo }} · {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido' : 'pedidos' }} sin contar cancelados
        @if (c.cierre) { · <b class="ok-texto">Cerrada por {{ c.cierre.cerradoPor }} ({{ c.cierre.cerradoEn | hora }})</b> }</p>
      @if (c.fechas.length) {
        <div class="chips" style="margin-bottom:12px">
          <span class="muted" style="font-size:13px">Cierres recientes:</span>
          @for (f of c.fechas.slice(0, 8); track f) {
            <button type="button" class="chip" [class.hot]="f === c.fecha" style="border:0;cursor:pointer" (click)="cambiarFecha(f)">{{ dia(f) }}</button>
          }
        </div>
      }

      <div class="kpis num">
        <div class="kpi"><div class="lbl">Ventas del día</div><div class="v">{{ c.ventas | dinero }}</div></div>
        <div class="kpi"><div class="lbl">Efectivo recibido</div><div class="v">{{ c.efectivoRecibido | dinero }}</div></div>
        <div class="kpi"><div class="lbl">Transferencias</div><div class="v">{{ c.transferencias | dinero }}</div></div>
        <div class="kpi"><div class="lbl">En línea</div><div class="v">{{ c.enLinea | dinero }}</div></div>
        <div class="kpi"><div class="lbl">Por cobrar</div><div class="v" [style.color]="c.porCobrar ? 'var(--warn)' : ''">{{ c.porCobrar | dinero }}</div></div>
      </div>

      <div class="grid-g">
        <form class="panel" (ngSubmit)="guardar()">
          <h3>Cuadre del efectivo{{ c.sede ? ' · ' + c.sede : '' }}</h3>
          @if (!c.puedeCerrar) {
            <div class="alerta aviso">Estás viendo todas las sedes sumadas. Para cerrar la caja, escoge una sede en la barra de arriba.</div>
          }
          <div class="row2">
            <div class="field"><label for="cBase">Base con que abrió la caja</label>
              <input id="cBase" name="cBase" type="number" min="0" step="1000" [(ngModel)]="f.baseInicial" (ngModelChange)="recalcular()"></div>
            <div class="field"><label for="cGastos">Gastos pagados en efectivo</label>
              <input id="cGastos" name="cGastos" type="number" min="0" step="1000" [(ngModel)]="f.gastos" (ngModelChange)="recalcular()"></div>
          </div>
          <div class="field"><label for="cNotaG">¿En qué se gastó? <span class="hint">(opcional)</span></label>
            <input id="cNotaG" name="cNotaG" [(ngModel)]="f.notaGastos" placeholder="Ej: hielo $8.000, gas $45.000"></div>
          <dl class="datos num">
            <dt>Base</dt><dd>{{ f.baseInicial | dinero }}</dd>
            <dt>+ Efectivo recibido</dt><dd>{{ c.efectivoRecibido | dinero }}</dd>
            <dt>− Gastos</dt><dd>{{ f.gastos | dinero }}</dd>
            <dt><b>Debería haber en caja</b></dt><dd><b>{{ esperado() | dinero }}</b></dd>
          </dl>
          <div class="field"><label for="cContado">Efectivo que contaste</label>
            <input id="cContado" name="cContado" type="number" min="0" step="1000" [(ngModel)]="f.efectivoContado" (ngModelChange)="recalcular()"></div>
          @let dif = diferencia();
          <div class="alerta" [class.buena]="dif === 0" [class.aviso]="dif > 0" [class.mala]="dif < 0">
            @if (dif === 0) { <b>✓ La caja cuadra.</b> }
            @else if (dif > 0) { <b>▲ Sobran {{ dif | dinero }}.</b> Revisa si quedó algún pedido sin marcar como pagado. }
            @else { <b>▼ Faltan {{ -dif | dinero }}.</b> Revisa los gastos y lo que entregaron los domiciliarios. }
          </div>
          <div class="field"><label for="cNota">Nota del cierre <span class="hint">(opcional)</span></label>
            <textarea id="cNota" name="cNota" [(ngModel)]="f.nota" placeholder="Ej: quedó un billete de $50.000 roto"></textarea></div>
          <div><button class="btn main" type="submit" [disabled]="guardando() || !c.puedeCerrar">{{ guardando() ? 'Guardando…' : c.cierre ? 'Actualizar cierre' : 'Cerrar caja' }}</button></div>
        </form>

        <div class="stack" style="gap:16px">
          <section class="panel">
            <h3>Cómo entró la plata</h3>
            <div class="tablewrap"><table class="num">
              <thead><tr><th>Medio</th><th class="r">Pedidos</th><th class="r">Recibido</th><th class="r">Pendiente</th></tr></thead>
              <tbody>
                @for (m of c.medios; track m.clave) {
                  <tr><td>{{ m.nombre }}</td><td class="r">{{ m.pedidos }}</td><td class="r">{{ m.recibido | dinero }}</td>
                    <td class="r" [style.color]="m.pendiente ? 'var(--warn)' : ''">{{ m.pendiente | dinero }}</td></tr>
                } @empty { <tr><td colspan="4" class="muted">No hay pedidos este día.</td></tr> }
              </tbody>
            </table></div>
          </section>

          <section class="panel">
            <h3>Domiciliarios</h3>
            @if (c.domiciliarios.length) {
              <div class="tablewrap"><table class="num">
                <thead><tr><th>Domiciliario</th><th class="r">Entregados</th><th class="r">Efectivo a entregar</th><th class="r">Domicilios</th></tr></thead>
                <tbody>
                  @for (d of c.domiciliarios; track d.id) {
                    <tr><td>{{ d.nombre }}</td><td class="r">{{ d.entregados }} de {{ d.pedidos }}</td>
                      <td class="r"><b>{{ d.efectivoCobrado | dinero }}</b>@if (d.efectivoACobrar > d.efectivoCobrado) {<div class="muted">de {{ d.efectivoACobrar | dinero }}</div>}</td>
                      <td class="r">{{ d.domicilios | dinero }}</td></tr>
                  }
                </tbody>
              </table></div>
              <span class="hint">«Efectivo a entregar»: lo que cobró en efectivo en los pedidos que ya entregó. «Domicilios»: lo que se cobró de domicilio en sus pedidos.</span>
            } @else {
              <p class="muted">Ningún pedido de este día tiene domiciliario asignado.</p>
            }
          </section>

          <section class="panel">
            <h3>Falta por cobrar</h3>
            @for (p of c.pendientes; track p.id) {
              <div class="row" style="justify-content:space-between">
                <span><b class="num">{{ p.codigo }}</b> · {{ p.cliente }}<br><span class="muted">{{ p.medio }} · {{ nombrePago(p.estadoPago) }} · {{ nombreEstado(p.estado) }}</span></span>
                <b class="num">{{ p.total | dinero }}</b>
              </div>
            } @empty { <p class="muted">Todo lo de este día está cobrado.</p> }
            @if (c.pendientes.length) {
              <a class="linkbtn" [routerLink]="emp.url('/admin/pedidos')" [queryParams]="{ filtro: 'POR_PAGAR' }">Ir a los pedidos por pagar</a>
            }
          </section>
        </div>
      </div>
    } @else if (!error()) {
      <div class="kpis">@for (i of [1, 2, 3, 4]; track i) { <div class="esqueleto" style="height:100px"></div> }</div>
    }
  `,
})
export class CajaPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  protected emp = inject(EmpresaActual);

  protected caja = signal<Caja | null>(null);
  protected fecha = signal('');
  protected error = signal('');
  protected guardando = signal(false);
  protected f: CierreCajaForm = { baseInicial: 0, gastos: 0, notaGastos: '', efectivoContado: 0, nota: '' };
  /** Cambia con cada tecla para recalcular el cuadre (f es un objeto plano del formulario). */
  private version = signal(0);

  protected esperado = computed(() => {
    this.version();
    return (Number(this.f.baseInicial) || 0) + (this.caja()?.efectivoRecibido ?? 0) - (Number(this.f.gastos) || 0);
  });
  protected diferencia = computed(() => {
    this.version();
    return (Number(this.f.efectivoContado) || 0) - this.esperado();
  });

  constructor() {
    this.cargar(null);
  }

  protected recalcular(): void { this.version.update((v) => v + 1); }

  protected cambiarFecha(f: string): void {
    if (f) this.cargar(f);
  }

  private cargar(fecha: string | null): void {
    this.error.set('');
    this.api.caja(fecha).subscribe({ next: (c) => this.mostrar(c), error: (e) => this.error.set(mensajeError(e)) });
  }

  private mostrar(c: Caja): void {
    this.caja.set(c);
    this.fecha.set(c.fecha);
    const k = c.cierre;
    this.f = k ? { baseInicial: k.baseInicial, gastos: k.gastos, notaGastos: k.notaGastos, efectivoContado: k.efectivoContado, nota: k.nota }
      : { baseInicial: 0, gastos: 0, notaGastos: '', efectivoContado: 0, nota: '' };
    this.recalcular();
  }

  protected guardar(): void {
    const c = this.caja();
    if (!c) return;
    this.guardando.set(true);
    this.api.cerrarCaja(c.fecha, {
      ...this.f, baseInicial: Number(this.f.baseInicial) || 0, gastos: Number(this.f.gastos) || 0,
      efectivoContado: Number(this.f.efectivoContado) || 0,
    }).subscribe({
      next: (r) => { this.guardando.set(false); this.mostrar(r); this.avisos.mostrar('Cierre de caja guardado'); },
      error: (e) => { this.guardando.set(false); this.error.set(mensajeError(e)); },
    });
  }

  protected dia(iso: string): string { return diaCorto(iso); }
  protected nombrePago(e: keyof typeof NOMBRE_PAGO): string { return NOMBRE_PAGO[e]; }
  protected nombreEstado(e: keyof typeof NOMBRE_ESTADO): string { return NOMBRE_ESTADO[e]; }
}
