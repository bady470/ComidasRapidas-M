import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TiendaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe, copiar } from '../core/formato';
import { EstadoPago, Seguimiento } from '../core/modelos';

/**
 * «Pagar pedido» para pedidos por transferencia: muestra la cuenta y el valor, y deja adjuntar
 * el comprobante (foto, captura o PDF). Al enviarlo, la tienda recibe un aviso en su portal.
 */
@Component({
  selector: 'app-pagar-pedido',
  imports: [DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estadoPago() === 'RECIBIDO') {
      <div class="alerta buena">Pago confirmado. ¡Gracias!</div>
    } @else {
      <div class="panel pagar">
        <div class="row" style="justify-content:space-between">
          <h3>Pagar pedido</h3>
          <b class="price num" style="font-size:22px">{{ total() | dinero }}</b>
        </div>
        @if (estadoPago() === 'POR_CONFIRMAR') {
          <div class="alerta aviso">Recibimos tu comprobante. La tienda lo está revisando y te confirmará el pago.</div>
        }
        <ol class="pasos-pago">
          <li><span>Transfiere <b class="num">{{ total() | dinero }}</b> a <b>{{ entidad() }}</b>:</span>
            <div class="cuenta-pago">
              <div><span class="muted">{{ titular() }}</span><br><b class="num">{{ numero() }}</b></div>
              <button class="copy" type="button" (click)="copiarNumero()">Copiar</button>
            </div>
          </li>
          <li><span>Toma una captura del comprobante y adjúntala aquí.</span>
            <label class="subir-comprobante" [class.listo]="!!archivo()">
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden (change)="elegir($event)">
              @if (archivo(); as a) { <b>{{ a.name }}</b><span class="muted">Toca para cambiarlo</span> }
              @else { <b>{{ estadoPago() === 'POR_CONFIRMAR' ? 'Enviar otro comprobante' : 'Adjuntar comprobante' }}</b><span class="muted">Foto, captura de pantalla o PDF (máx. 5 MB)</span> }
            </label>
          </li>
        </ol>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <button class="primary" type="button" [disabled]="!archivo() || enviando()" (click)="enviar()">
          {{ enviando() ? 'Enviando…' : 'Enviar comprobante' }}
        </button>
      </div>
    }
  `,
})
export class PagarPedido {
  private api = inject(TiendaApi);
  private avisos = inject(Avisos);

  readonly codigo = input.required<string>();
  readonly celular = input.required<string>();
  readonly total = input.required<number>();
  readonly entidad = input('');
  readonly titular = input('');
  readonly numero = input('');
  readonly estadoPago = input<EstadoPago>('PENDIENTE');
  /** Seguimiento actualizado después de enviar el comprobante. */
  readonly enviado = output<Seguimiento>();

  protected archivo = signal<File | null>(null);
  protected enviando = signal(false);
  protected error = signal('');

  protected async copiarNumero(): Promise<void> {
    this.avisos.mostrar((await copiar(this.numero())) ? 'Número copiado' : 'Mantén presionado el número para copiarlo');
  }

  protected elegir(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    input.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { this.error.set('El archivo pesa más de 5 MB. Envía una captura de pantalla.'); return; }
    this.error.set('');
    this.archivo.set(f);
  }

  protected enviar(): void {
    const f = this.archivo();
    if (!f) return;
    this.enviando.set(true);
    this.error.set('');
    this.api.subirComprobante(this.codigo(), this.celular(), f).subscribe({
      next: (s) => {
        this.archivo.set(null);
        this.enviando.set(false);
        this.avisos.mostrar('Comprobante enviado. ¡Gracias!');
        this.enviado.emit(s);
      },
      error: (e) => { this.error.set(mensajeError(e)); this.enviando.set(false); },
    });
  }
}
