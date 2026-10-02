import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LlavesPasarela, llavesDesde } from '../compartido/llaves-pasarela';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe } from '../core/formato';
import { ConfigPagosEmpresa, ConfigPagosEmpresaForm, Llaves, ModalidadPago, NOMBRE_MODALIDAD, Proveedor } from '../core/modelos';

/** Pagos en línea de una empresa: modalidad, pasarela, comisión de la plataforma y llaves de su cuenta propia. */
@Component({
  selector: 'app-pagos-empresa',
  imports: [FormsModule, RouterLink, DineroPipe, LlavesPasarela],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="panel" (ngSubmit)="guardar()">
      <div class="row" style="justify-content:space-between">
        <h3>Pagos en línea</h3>
        @if (config(); as c) {
          <span class="st" [class.tx-APROBADO]="c.listo" [class.tx-VENCIDO]="!c.listo">{{ c.listo ? 'Cobrando en línea' : 'Sin pago en línea' }}</span>
        }
      </div>
      @if (config(); as c) {
        @if (!c.moduloActivo) {
          <div class="alerta aviso">El plan de esta empresa no incluye el módulo «Pagos en línea». Actívalo en «Módulos» para poder cobrar en línea.</div>
        } @else if (!c.listo && c.modalidad !== 'APAGADO') {
          <div class="alerta aviso">{{ c.motivo }}</div>
        }

        <div class="field"><span class="flabel">Modalidad</span>
          <div class="opts">
            @for (m of modalidades; track m.valor) {
              <label class="opt"><input type="radio" name="modalidad" [value]="m.valor" [(ngModel)]="f.modalidad">
                <span><b>{{ nombreModalidad(m.valor) }}</b><br><span class="muted">{{ m.detalle }}</span></span></label>
            }
          </div>
        </div>

        @if (f.modalidad !== 'APAGADO') {
          <div class="row2">
            <div class="field"><label for="peProv">Pasarela</label>
              <select id="peProv" name="peProv" [ngModel]="f.proveedor" (ngModelChange)="cambiarProveedor($event)">
                <option value="WOMPI">Wompi (Bancolombia)</option>
                <option value="BOLD">Bold</option>
              </select></div>
            <label class="check" style="align-self:end;padding-bottom:10px">
              <input type="checkbox" name="pePausa" [(ngModel)]="f.pausado"> Pausado</label>
          </div>
        }

        @if (f.modalidad === 'PLATAFORMA') {
          <div class="row2">
            <div class="field"><label for="pePct">Comisión de la plataforma (%)</label>
              <input id="pePct" name="pePct" type="number" min="0" max="50" step="0.1" [(ngModel)]="f.comisionPorcentaje"></div>
            <div class="field"><label for="peFija">Comisión fija por pago ($)</label>
              <input id="peFija" name="peFija" type="number" min="0" step="100" [(ngModel)]="f.comisionFija"></div>
          </div>
          <span class="hint">Se descuenta de cada pago aprobado; lo demás queda «por liquidar» a la empresa. Debe cubrir lo que cobra la pasarela.</span>
          <div class="kpis num" style="margin-top:8px">
            <div class="kpi"><div class="lbl">Por liquidar</div><div class="v">{{ c.totales.porLiquidar | dinero }}</div></div>
            <div class="kpi"><div class="lbl">Comisiones</div><div class="v ok">{{ c.totales.comisiones | dinero }}</div></div>
          </div>
        }

        @if (f.modalidad === 'PROPIA') {
          <label class="check"><input type="checkbox" name="peEdit" [(ngModel)]="f.editablePorEmpresa"> La empresa puede escribir sus llaves desde su portal</label>
          <app-llaves-pasarela [(valor)]="llaves" [guardadas]="c.llaves" [urlEventos]="urlPara(c.urlEventos)" prefijo="sup" />
        }

        @if (error()) { <p class="err">{{ error() }}</p> }
        <div class="row">
          <button class="btn main" type="submit" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : 'Guardar pagos en línea' }}</button>
          @if (c.totales.aprobados) {
            <a class="linkbtn" routerLink="/superadmin/pagos" [queryParams]="{ empresa: uuid() }">Ver sus {{ c.totales.aprobados }} pagos</a>
          }
        </div>
      } @else if (error()) {
        <p class="err">{{ error() }}</p>
      }
    </form>
  `,
})
export class PagosEmpresa {
  private api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  readonly uuid = input.required<string>();

  protected readonly modalidades: { valor: ModalidadPago; detalle: string }[] = [
    { valor: 'APAGADO', detalle: 'Sus clientes pagan por transferencia (con comprobante) o en efectivo, como siempre.' },
    { valor: 'PROPIA', detalle: 'Cobra con su cuenta de Wompi o Bold: la plata le llega directo.' },
    { valor: 'PLATAFORMA', detalle: 'Cobra con la cuenta de la plataforma y se le liquida descontando la comisión.' },
  ];

  protected config = signal<ConfigPagosEmpresa | null>(null);
  protected error = signal('');
  protected ocupado = signal(false);
  protected llaves = signal<Llaves>(llavesDesde(null, 'WOMPI'));
  protected f: Omit<ConfigPagosEmpresaForm, 'llaves'> = {
    modalidad: 'APAGADO', proveedor: 'WOMPI', editablePorEmpresa: true, pausado: false, comisionPorcentaje: 0, comisionFija: 0,
  };

  constructor() {
    effect(() => {
      const uuid = this.uuid();
      untracked(() => this.api.pagosEmpresa(uuid).subscribe({ next: (c) => this.mostrar(c), error: (e) => this.error.set(mensajeError(e)) }));
    });
  }

  protected nombreModalidad(m: ModalidadPago): string { return NOMBRE_MODALIDAD[m]; }

  private mostrar(c: ConfigPagosEmpresa): void {
    this.config.set(c);
    this.error.set('');
    this.f = {
      modalidad: c.modalidad, proveedor: c.proveedor, editablePorEmpresa: c.editablePorEmpresa, pausado: c.pausado,
      comisionPorcentaje: Number(c.comisionPorcentaje), comisionFija: c.comisionFija,
    };
    this.llaves.set(llavesDesde(c.llaves, c.proveedor));
  }

  /** El link propio de la empresa con la pasarela escogida en el formulario (aunque todavía no se haya guardado). */
  protected urlPara(url: string): string {
    return url.replace(/\/pagos\/(wompi|bold)\/eventos\//, `/pagos/${this.f.proveedor.toLowerCase()}/eventos/`);
  }

  protected cambiarProveedor(p: Proveedor): void {
    this.f.proveedor = p;
    this.llaves.set(llavesDesde(this.config()?.llaves ?? null, p));
  }

  protected guardar(): void {
    this.ocupado.set(true);
    this.error.set('');
    const llaves = this.f.modalidad === 'PROPIA' ? { ...this.llaves(), proveedor: this.f.proveedor } : null;
    this.api.guardarPagosEmpresa(this.uuid(), {
      ...this.f, comisionPorcentaje: Number(this.f.comisionPorcentaje) || 0, comisionFija: Number(this.f.comisionFija) || 0, llaves,
    }).subscribe({
      next: (c) => { this.ocupado.set(false); this.mostrar(c); this.avisos.mostrar('Pagos en línea guardados'); },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
