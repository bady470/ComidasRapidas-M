import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LlavesPasarela, llavesDesde } from '../compartido/llaves-pasarela';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe, HoraPipe } from '../core/formato';
import {
  EmpresaResumen, EstadoTransaccion, Liquidacion, Llaves, NOMBRE_TRANSACCION, PasarelaPlataforma, Proveedor, Recaudos,
} from '../core/modelos';

type Pestana = 'pagos' | 'cuentas';

/**
 * Pagos en línea de toda la plataforma:
 *  - Pagos y liquidaciones: cada pago en línea de cada empresa y, en la modalidad «cuenta de la plataforma»,
 *    lo que se le debe a cada empresa; se marcan como liquidados cuando se les transfiere.
 *  - Cuentas de la plataforma: las llaves de Wompi y Bold con las que cobra la plataforma.
 */
@Component({
  selector: 'app-pagos',
  imports: [FormsModule, RouterLink, DineroPipe, HoraPipe, LlavesPasarela],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h">
      <h1>Pagos en línea</h1>
      <div class="seg" role="group" aria-label="Sección">
        <button type="button" [attr.aria-pressed]="pestana() === 'pagos'" (click)="pestana.set('pagos')">Pagos y liquidaciones</button>
        <button type="button" [attr.aria-pressed]="pestana() === 'cuentas'" (click)="pestana.set('cuentas')">Cuentas de la plataforma</button>
      </div>
    </div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (pestana() === 'pagos') {
      <div class="toolbar" style="margin-bottom:12px">
        <select aria-label="Empresa" [ngModel]="empresa()" (ngModelChange)="empresa.set($event); cargar()">
          <option value="">Todas las empresas</option>
          @for (e of empresas(); track e.uuid) { <option [value]="e.uuid">{{ e.nombreComercial }}</option> }
        </select>
        <select aria-label="Liquidación" [ngModel]="liquidacion()" (ngModelChange)="liquidacion.set($event); cargar()">
          <option value="">Toda liquidación</option>
          <option value="POR_LIQUIDAR">Por liquidar</option>
          <option value="LIQUIDADO">Liquidados</option>
          <option value="NO_APLICA">Cuenta propia (no aplica)</option>
        </select>
        <select aria-label="Estado" [ngModel]="estado()" (ngModelChange)="estado.set($event); cargar()">
          <option value="">Todo estado</option>
          @for (e of estados; track e) { <option [value]="e">{{ nombre(e) }}</option> }
        </select>
      </div>

      @if (recaudos(); as r) {
        <div class="kpis num">
          <div class="kpi"><div class="lbl">Pagos aprobados</div><div class="v">{{ r.totales.aprobados }}</div></div>
          <div class="kpi"><div class="lbl">Total cobrado</div><div class="v">{{ r.totales.montoAprobado | dinero }}</div></div>
          <div class="kpi"><div class="lbl">Comisiones de la plataforma</div><div class="v ok">{{ r.totales.comisiones | dinero }}</div></div>
          <div class="kpi"><div class="lbl">Por liquidar a empresas</div><div class="v">{{ r.totales.porLiquidar | dinero }}</div></div>
        </div>

        @if (seleccion().size) {
          <div class="panel row" style="margin-bottom:12px;flex-wrap:wrap">
            <b>{{ seleccion().size }} {{ seleccion().size === 1 ? 'pago' : 'pagos' }} · {{ totalSeleccion() | dinero }} para la empresa</b>
            <input style="flex:1 1 220px;width:auto" name="nota" [(ngModel)]="nota" placeholder="Nota (ej: transferencia #123 del 5 de octubre)">
            <button class="btn okb" type="button" [disabled]="ocupado()" (click)="liquidar()">Marcar como liquidados</button>
          </div>
        }

        <div class="panel tablewrap tabla-datos" style="padding:0;margin-bottom:40px">
          <table style="min-width:980px">
            <thead><tr><th></th><th>Fecha</th><th>Empresa</th><th>Pedido</th><th class="r">Valor</th><th>Estado</th><th>Cuenta</th>
              <th class="r">Comisión</th><th class="r">Para la empresa</th><th>Liquidación</th></tr></thead>
            <tbody>
              @for (t of r.lista; track t.uuid) {
                <tr>
                  <td>@if (t.estado === 'APROBADO' && t.liquidacion === 'POR_LIQUIDAR') {
                    <input type="checkbox" [checked]="seleccion().has(t.uuid)" (change)="alternar(t.uuid)" [attr.aria-label]="'Seleccionar ' + t.referencia">
                  }</td>
                  <td>{{ t.creado | hora }}</td>
                  <td>{{ t.empresaNombre }}<div class="muted num">/{{ t.empresa }}</div></td>
                  <td class="num"><b>{{ t.codigoPedido }}</b><div class="muted">{{ t.referencia }}</div></td>
                  <td class="r num">{{ t.monto | dinero }}</td>
                  <td><span class="st tx-{{ t.estado }}">{{ nombre(t.estado) }}</span>
                    <div class="muted">{{ t.medio }}{{ t.ambiente === 'PRUEBAS' ? ' · pruebas' : '' }}</div>
                    @if (t.detalle) { <div class="muted">{{ t.detalle }}</div> }</td>
                  <td>{{ t.proveedor === 'WOMPI' ? 'Wompi' : 'Bold' }}<div class="muted">{{ t.modalidad === 'PLATAFORMA' ? 'de la plataforma' : 'propia' }}</div></td>
                  <td class="r num">{{ t.comision | dinero }}</td>
                  <td class="r num">{{ t.neto | dinero }}</td>
                  <td><span class="st liq-{{ t.liquidacion }}">{{ nombreLiquidacion(t.liquidacion) }}</span>
                    @if (t.liquidado) { <div class="muted">{{ t.liquidado | hora }}{{ t.notaLiquidacion ? ' · ' + t.notaLiquidacion : '' }}</div> }</td>
                </tr>
              } @empty {
                <tr><td colspan="10" class="muted" style="padding:16px">No hay pagos con estos filtros.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else {
      <p class="muted" style="margin-bottom:16px">Con estas cuentas cobra la plataforma a las empresas que tengan la modalidad «Cuenta de la plataforma».
        Cada empresa se configura en su detalle (<a routerLink="/superadmin/empresas">Empresas</a> → Pagos en línea).</p>
      <div class="two" style="margin-bottom:40px">
        @for (p of pasarelas(); track p.llaves.proveedor) {
          <form class="panel" (ngSubmit)="guardarPasarela(p.llaves.proveedor)">
            <div class="row" style="justify-content:space-between">
              <h3>{{ p.llaves.nombreProveedor }}</h3>
              <span class="st" [class.tx-APROBADO]="p.activa" [class.tx-VENCIDO]="!p.activa">{{ p.activa ? 'Activa' : 'Inactiva' }}</span>
            </div>
            <p class="muted">{{ p.empresasUsandola }} {{ p.empresasUsandola === 1 ? 'empresa la usa' : 'empresas la usan' }}.
              @if (!p.completa) { Falta: {{ p.faltante }} }</p>
            <app-llaves-pasarela [valor]="form()[p.llaves.proveedor].llaves" (valorChange)="cambiarLlaves(p.llaves.proveedor, $event)"
              [guardadas]="p.llaves" [urlEventos]="p.urlEventos" [prefijo]="'pl' + p.llaves.proveedor" />
            <label class="check"><input type="checkbox" [name]="'act' + p.llaves.proveedor" [ngModel]="form()[p.llaves.proveedor].activa"
              (ngModelChange)="cambiarActiva(p.llaves.proveedor, $event)"> Cuenta activa (las empresas pueden cobrar con ella)</label>
            <div><button class="btn main" type="submit" [disabled]="ocupado()">Guardar</button></div>
          </form>
        }
      </div>
    }
  `,
})
export class PagosPage {
  private api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  protected readonly estados: EstadoTransaccion[] = ['APROBADO', 'PENDIENTE', 'RECHAZADO', 'ANULADO', 'ERROR', 'VENCIDO'];
  protected pestana = signal<Pestana>('pagos');
  protected error = signal('');
  protected ocupado = signal(false);

  protected empresas = signal<EmpresaResumen[]>([]);
  protected empresa = signal('');
  protected liquidacion = signal<Liquidacion | ''>('');
  protected estado = signal('');
  protected recaudos = signal<Recaudos | null>(null);
  protected seleccion = signal(new Set<string>());
  protected nota = '';
  protected totalSeleccion = computed(() => {
    const sel = this.seleccion();
    return (this.recaudos()?.lista ?? []).filter((t) => sel.has(t.uuid)).reduce((s, t) => s + t.neto, 0);
  });

  protected pasarelas = signal<PasarelaPlataforma[]>([]);
  protected form = signal<Record<Proveedor, { llaves: Llaves; activa: boolean }>>({
    WOMPI: { llaves: llavesDesde(null, 'WOMPI'), activa: false },
    BOLD: { llaves: llavesDesde(null, 'BOLD'), activa: false },
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.get('empresa')) this.empresa.set(q.get('empresa')!);
    if (q.get('vista') === 'cuentas') this.pestana.set('cuentas');
    this.api.empresas().subscribe({ next: (l) => this.empresas.set(l), error: () => {} });
    this.api.pasarelas().subscribe({ next: (l) => l.forEach((p) => this.mostrarPasarela(p)), error: (e) => this.error.set(mensajeError(e)) });
    this.cargar();
  }

  protected cargar(): void {
    this.seleccion.set(new Set());
    this.api.transacciones({
      empresa: this.empresa() || undefined, liquidacion: this.liquidacion() || undefined, estado: this.estado() || undefined,
    }).subscribe({ next: (r) => { this.recaudos.set(r); this.error.set(''); }, error: (e) => this.error.set(mensajeError(e)) });
  }

  protected nombre(e: EstadoTransaccion): string { return NOMBRE_TRANSACCION[e]; }
  protected nombreLiquidacion(l: Liquidacion): string {
    return l === 'POR_LIQUIDAR' ? 'Por liquidar' : l === 'LIQUIDADO' ? 'Liquidado' : 'No aplica';
  }

  protected alternar(uuid: string): void {
    this.seleccion.update((s) => {
      const n = new Set(s);
      if (n.has(uuid)) n.delete(uuid); else n.add(uuid);
      return n;
    });
  }

  protected liquidar(): void {
    this.ocupado.set(true);
    this.api.liquidar([...this.seleccion()], this.nota.trim()).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.nota = '';
        this.avisos.mostrar(`${r.liquidados} ${r.liquidados === 1 ? 'pago marcado' : 'pagos marcados'} como liquidados`);
        this.cargar();
      },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }

  private mostrarPasarela(p: PasarelaPlataforma): void {
    this.pasarelas.update((l) => {
      const i = l.findIndex((x) => x.llaves.proveedor === p.llaves.proveedor);
      return i < 0 ? [...l, p] : l.map((x, j) => (j === i ? p : x));
    });
    this.form.update((f) => ({ ...f, [p.llaves.proveedor]: { llaves: llavesDesde(p.llaves, p.llaves.proveedor), activa: p.activa } }));
  }

  protected cambiarLlaves(p: Proveedor, llaves: Llaves): void {
    this.form.update((f) => ({ ...f, [p]: { ...f[p], llaves } }));
  }

  protected cambiarActiva(p: Proveedor, activa: boolean): void {
    this.form.update((f) => ({ ...f, [p]: { ...f[p], activa } }));
  }

  protected guardarPasarela(p: Proveedor): void {
    const f = this.form()[p];
    this.ocupado.set(true);
    this.api.guardarPasarela(p, f.llaves, f.activa).subscribe({
      next: (r) => { this.ocupado.set(false); this.mostrarPasarela(r); this.error.set(''); this.avisos.mostrar('Cuenta guardada'); },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
