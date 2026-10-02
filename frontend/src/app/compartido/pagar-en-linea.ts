import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TiendaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { DineroPipe, dinero } from '../core/formato';
import { EstadoPago, EstadoPagoEnLinea, MetodoPago, Seguimiento, TipoEntrega } from '../core/modelos';

/**
 * «Pagar en línea» para pedidos con pasarela (Wompi, Bold): manda al cliente al checkout y, al volver,
 * muestra cómo quedó el pago. El pago se confirma solo (la pasarela avisa), así que no hay comprobante.
 * Si no puede o no quiere pagar en línea, puede cambiar a transferencia (con comprobante) o efectivo.
 */
@Component({
  selector: 'app-pagar-en-linea',
  imports: [FormsModule, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estadoPago() === 'RECIBIDO') {
      <div class="alerta buena">Pago confirmado{{ intento()?.medio ? ' con ' + intento()!.medio : '' }}. ¡Gracias!</div>
    } @else {
      <div class="panel pagar">
        <div class="row" style="justify-content:space-between">
          <h3>Pagar en línea</h3>
          <b class="price num" style="font-size:22px">{{ total() | dinero }}</b>
        </div>

        @if (intento(); as i) {
          @switch (i.estado) {
            @case ('PENDIENTE') {
              <div class="alerta aviso">
                Esperando la confirmación de {{ i.nombre }}. Si ya pagaste, se confirma solo en unos segundos; no cierres esta página.
              </div>
            }
            @case ('APROBADO') { }
            @default {
              <div class="alerta mala">El pago no se completó{{ i.detalle ? ' (' + i.detalle + ')' : '' }}. Puedes intentarlo de nuevo o pagar de otra forma.</div>
            }
          }
        }

        @if (disponible(); as d) {
          <p class="muted">Pagas con <b>{{ d.nombre }}</b>: {{ d.medios }}. El pago se confirma solo, sin enviar comprobante.</p>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <button class="primary" type="button" [disabled]="ocupado()" (click)="pagar()">
            {{ ocupado() ? 'Abriendo el pago…' : (intento() ? 'Volver a pagar ' : 'Pagar ') + precio() }}
          </button>
          @if (intento()?.estado === 'PENDIENTE') {
            <button class="ghost" type="button" [disabled]="revisando()" (click)="revisar()">{{ revisando() ? 'Revisando…' : 'Ya pagué, revisar' }}</button>
          }
        } @else {
          <div class="alerta aviso">El pago en línea no está disponible en este momento. Escoge otra forma de pago.</div>
        }

        @if (alternativas().length) {
          @if (!cambiando()) {
            <button class="linkbtn" type="button" (click)="cambiando.set(true)">Prefiero pagar de otra forma</button>
          } @else {
            <div class="field">
              <span class="flabel">¿Cómo prefieres pagar?</span>
              <div class="opts">
                @for (a of alternativas(); track a.valor) {
                  <label class="opt"><input type="radio" name="otraForma" [value]="a.valor" [(ngModel)]="otra">
                    <span><b>{{ a.titulo }}</b><br><span class="muted">{{ a.detalle }}</span></span></label>
                }
              </div>
            </div>
            <div class="row">
              <button class="btn main" type="button" [disabled]="!otra || ocupado()" (click)="cambiar()">Cambiar forma de pago</button>
              <button class="linkbtn" type="button" (click)="cambiando.set(false)">Cancelar</button>
            </div>
          }
        }
      </div>
    }
  `,
})
export class PagarEnLinea {
  private api = inject(TiendaApi);
  private avisos = inject(Avisos);
  private estado = inject(EstadoTienda);
  private emp = inject(EmpresaActual);

  readonly codigo = input.required<string>();
  readonly celular = input.required<string>();
  readonly total = input.required<number>();
  readonly estadoPago = input<EstadoPago>('PENDIENTE');
  readonly intento = input<EstadoPagoEnLinea | null>(null);
  readonly tipoEntrega = input<TipoEntrega>('DOMICILIO');
  /** Seguimiento actualizado (al revisar el pago o cambiar la forma de pago). */
  readonly cambiado = output<Seguimiento>();

  protected ocupado = signal(false);
  protected revisando = signal(false);
  protected cambiando = signal(false);
  protected error = signal('');
  protected otra = '';

  private tienda = computed(() => this.estado.catalogo()?.tienda ?? null);
  protected disponible = computed(() => this.tienda()?.pagoEnLinea ?? null);
  protected alternativas = computed(() => {
    const t = this.tienda();
    if (!t) return [];
    const lista = t.cuentas.map((c) => ({ valor: 'C' + c.id, titulo: 'Transferencia a ' + c.entidad, detalle: 'Transfieres y adjuntas el comprobante' }));
    if (t.efectivo) lista.push({ valor: 'EFECTIVO', titulo: 'Efectivo', detalle: this.tipoEntrega() === 'RECOGER' ? 'Pagas al recoger' : 'Pagas al recibir' });
    return lista;
  });

  protected precio(): string {
    return dinero(this.total());
  }

  /** Crea el cobro y lleva al cliente al checkout de la pasarela; al terminar vuelve al seguimiento del pedido. */
  protected pagar(): void {
    this.ocupado.set(true);
    this.error.set('');
    const retorno = location.origin + this.emp.url('/pedido/' + encodeURIComponent(this.codigo())) + '?pago=retorno';
    this.api.iniciarPago(this.codigo(), this.celular(), retorno).subscribe({
      next: (r) => { location.href = r.url; },
      error: (e) => { this.error.set(mensajeError(e)); this.ocupado.set(false); },
    });
  }

  protected revisar(): void {
    this.revisando.set(true);
    this.api.verificarPago(this.codigo(), this.celular(), null).subscribe({
      next: (s) => {
        this.revisando.set(false);
        if (s.estadoPago !== 'RECIBIDO') this.avisos.mostrar('Todavía no nos llega la confirmación. Te avisamos aquí apenas llegue.');
        this.cambiado.emit(s);
      },
      error: (e) => { this.revisando.set(false); this.error.set(mensajeError(e)); },
    });
  }

  protected cambiar(): void {
    if (!this.otra) return;
    const metodo: MetodoPago = this.otra === 'EFECTIVO' ? 'EFECTIVO' : 'CUENTA';
    this.ocupado.set(true);
    this.error.set('');
    this.api.cambiarMetodoPago(this.codigo(), this.celular(), metodo, metodo === 'CUENTA' ? Number(this.otra.slice(1)) : null).subscribe({
      next: (s) => {
        this.ocupado.set(false);
        this.cambiando.set(false);
        this.avisos.mostrar('Forma de pago cambiada');
        this.cambiado.emit(s);
      },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
