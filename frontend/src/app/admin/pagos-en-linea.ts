import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LlavesPasarela, llavesDesde } from '../compartido/llaves-pasarela';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe, HoraPipe, dinero } from '../core/formato';
import { EstadoTransaccion, Llaves, NOMBRE_TRANSACCION, PortalPagos } from '../core/modelos';

/**
 * Pagos en línea de la empresa: cómo cobra (cuenta propia o de la plataforma), sus llaves si cobra con cuenta propia,
 * pausar el pago en línea y los últimos pagos con su estado (y su liquidación si cobra la plataforma).
 */
@Component({
  selector: 'app-pagos-en-linea',
  imports: [FormsModule, DineroPipe, HoraPipe, LlavesPasarela],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h"><h1>Pagos en línea</h1></div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (datos(); as d) {
      @let c = d.config;
      <div class="alerta" [class.buena]="c.listo" [class.aviso]="!c.listo" style="margin-bottom:16px">
        @if (c.listo) {
          Listo: tus clientes pueden pagar en línea con <b>{{ c.llaves.nombreProveedor }}</b> y el pago se confirma solo, al instante.
          @if (c.llaves.ambiente === 'PRUEBAS' && c.modalidad === 'PROPIA') { <br>Estás en <b>ambiente de pruebas</b>: los pagos no son reales. }
        } @else {
          {{ c.motivo }} Mientras tanto, tus clientes pagan por transferencia (con comprobante) o en efectivo, como siempre.
        }
      </div>

      <div class="two">
        <div class="panel">
          <h3>Cómo cobras</h3>
          @switch (c.modalidad) {
            @case ('PROPIA') {
              <p>Cobras con <b>tu propia cuenta de {{ c.llaves.nombreProveedor }}</b>. La plata te llega directo a ti; la plataforma no la toca.</p>
            }
            @case ('PLATAFORMA') {
              <p>Cobras con <b>la cuenta de {{ c.llaves.nombreProveedor }} de la plataforma</b>. Te liquidamos tus pagos descontando
                la comisión de <b>{{ c.comisionPorcentaje }} %</b>{{ c.comisionFija ? ' + ' + precio(c.comisionFija) + ' por pago' : '' }}.</p>
              <div class="kpis num">
                <div class="kpi"><div class="lbl">Por liquidarte</div><div class="v">{{ c.totales.porLiquidar | dinero }}</div></div>
                <div class="kpi"><div class="lbl">Ya liquidado</div><div class="v ok">{{ c.totales.liquidado | dinero }}</div></div>
              </div>
            }
            @default {
              <p>El pago en línea no está activado para tu tienda. Escríbele a tu proveedor de la plataforma si quieres activarlo,
                con tu propia cuenta de Wompi o Bold, o con la de la plataforma.</p>
            }
          }
          @if (c.modalidad !== 'APAGADO') {
            <label class="check" style="margin-top:8px">
              <input type="checkbox" [checked]="!c.pausado" [disabled]="ocupado()" (change)="pausar(!$any($event.target).checked)">
              Ofrecer el pago en línea en mi tienda
            </label>
            <span class="hint">Si lo apagas, tus clientes solo ven transferencia y efectivo. La configuración no se pierde.</span>
          }
          <div class="kpis num" style="margin-top:12px">
            <div class="kpi"><div class="lbl">Pagos aprobados</div><div class="v">{{ c.totales.aprobados }}</div></div>
            <div class="kpi"><div class="lbl">Total cobrado en línea</div><div class="v">{{ c.totales.montoAprobado | dinero }}</div></div>
          </div>
        </div>

        @if (c.modalidad === 'PROPIA') {
          @if (c.editablePorEmpresa) {
            <form class="panel" (ngSubmit)="guardar()">
              <h3>Tu cuenta de {{ c.llaves.nombreProveedor }}</h3>
              <app-llaves-pasarela [(valor)]="llaves" [guardadas]="c.llaves" [urlEventos]="c.urlEventos" prefijo="emp" />
              <div><button class="btn main" type="submit" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar llaves' }}</button></div>
            </form>
          } @else {
            <div class="panel">
              <h3>Tu cuenta de {{ c.llaves.nombreProveedor }}</h3>
              <p class="muted">Las llaves de tu cuenta las administra tu proveedor de la plataforma. Escríbele si necesitas cambiarlas.</p>
            </div>
          }
        }
      </div>

      <div class="panel tablewrap tabla-datos" style="padding:0;margin-block:16px 40px">
        <table style="min-width:760px">
          <thead><tr><th>Fecha</th><th>Pedido</th><th class="r">Valor</th><th>Estado</th><th>Medio</th>
            @if (c.modalidad === 'PLATAFORMA') { <th class="r">Comisión</th><th class="r">Te llega</th><th>Liquidación</th> }</tr></thead>
          <tbody>
            @for (t of d.recientes; track t.uuid) {
              <tr>
                <td>{{ t.creado | hora }}</td>
                <td class="num"><b>{{ t.codigoPedido }}</b></td>
                <td class="r num">{{ t.monto | dinero }}</td>
                <td><span class="st tx-{{ t.estado }}">{{ nombre(t.estado) }}</span>@if (t.detalle) {<div class="muted">{{ t.detalle }}</div>}</td>
                <td>{{ t.medio || '—' }}</td>
                @if (c.modalidad === 'PLATAFORMA') {
                  <td class="r num">{{ t.comision | dinero }}</td>
                  <td class="r num">{{ t.neto | dinero }}</td>
                  <td>{{ t.liquidacion === 'LIQUIDADO' ? 'Liquidado' : t.liquidacion === 'POR_LIQUIDAR' ? 'Por liquidar' : '—' }}</td>
                }
              </tr>
            } @empty {
              <tr><td colspan="8" class="muted" style="padding:16px">Todavía no hay pagos en línea.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class PagosEnLineaPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);

  protected datos = signal<PortalPagos | null>(null);
  protected error = signal('');
  protected ocupado = signal(false);
  protected llaves = signal<Llaves>(llavesDesde(null, 'WOMPI'));

  constructor() {
    this.api.pagosEnLinea().subscribe({ next: (d) => this.mostrar(d), error: (e) => this.error.set(mensajeError(e)) });
  }

  private mostrar(d: PortalPagos): void {
    this.datos.set(d);
    this.error.set('');
    this.llaves.set(llavesDesde(d.config.llaves, d.config.proveedor));
  }

  protected nombre(e: EstadoTransaccion): string { return NOMBRE_TRANSACCION[e]; }
  protected precio(n: number): string { return dinero(n); }

  protected guardar(): void {
    this.ocupado.set(true);
    this.api.guardarLlavesPago(this.llaves()).subscribe({
      next: (d) => { this.ocupado.set(false); this.mostrar(d); this.avisos.mostrar('Llaves guardadas'); },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }

  protected pausar(pausado: boolean): void {
    this.ocupado.set(true);
    this.api.pausarPagoEnLinea(pausado).subscribe({
      next: (d) => { this.ocupado.set(false); this.mostrar(d); this.avisos.mostrar(pausado ? 'Pago en línea pausado' : 'Pago en línea activo'); },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
