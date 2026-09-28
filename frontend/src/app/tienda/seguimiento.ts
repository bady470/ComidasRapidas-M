import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TiendaApi, mensajeError } from '../core/api';
import { EmpresaActual } from '../core/empresa';
import { DiaLargoPipe, DineroPipe, HoraPipe } from '../core/formato';
import { EstadoPedido, NOMBRE_ESTADO, Seguimiento } from '../core/modelos';
import { guardarPedidoReciente, pedidosRecientes } from './recientes';

const PASOS: Record<string, { titulo: string; detalle: string }> = {
  NUEVO: { titulo: 'Recibimos tu pedido', detalle: 'Lo vamos a revisar y confirmar.' },
  CONFIRMADO: { titulo: 'Pedido confirmado', detalle: 'Ya quedó apartado.' },
  PREPARANDO: { titulo: 'Preparando tu pedido', detalle: 'Lo estamos alistando.' },
  EN_CAMINO: { titulo: 'Salió a domicilio', detalle: 'Va en camino a tu dirección.' },
  LISTO: { titulo: 'Listo para recoger', detalle: 'Ya puedes pasar por él.' },
  ENTREGADO: { titulo: 'Entregado', detalle: '¡Que lo disfrutes!' },
};

@Component({
  selector: 'app-seguimiento',
  imports: [FormsModule, RouterLink, DineroPipe, DiaLargoPipe, HoraPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="centro">
        @if (pedido(); as p) {
          <div class="row">
            <div class="stack" style="gap:2px">
              <span class="muted">Pedido de {{ p.nombre }}</span>
              <span class="code">{{ p.codigo }}</span>
            </div>
            <span class="spacer"></span>
            <span class="st st-{{ p.estado }}">{{ nombreEstado(p.estado) }}</span>
          </div>
          <div class="panel">
            <span class="lbl">{{ p.tipoEntrega === 'RECOGER' ? 'Recoges en el local' : 'Entrega a domicilio' }}</span>
            <b style="font-size:18px">{{ p.fechaEntrega | diaLargo }}{{ p.franja ? ' · ' + p.franja : '' }}</b>
            @if (p.tipoEntrega === 'RECOGER') { <span class="muted">{{ p.direccionTienda }}</span> }
            @else if (p.zona || p.barrio) { <span class="muted">{{ p.zona || p.barrio }}</span> }
          </div>

          @if (p.estado === 'CANCELADO') {
            <div class="alerta mala">Este pedido fue cancelado. Si crees que es un error, escríbenos por WhatsApp.</div>
          } @else {
            <div class="panel">
              <h3>¿Por dónde va?</h3>
              <ol class="timeline">
                @for (estado of p.flujo; track estado; let i = $index) {
                  <li [class.hecho]="i <= indice()" [class.actual]="i === indice()" [class.pendiente]="i > indice()">
                    <span class="dot">{{ i <= indice() ? '✓' : i + 1 }}</span>
                    <div>
                      <b>{{ paso(estado).titulo }}</b>
                      <div class="muted">
                        @if (horaDe(estado); as h) { {{ h | hora }} · }
                        {{ paso(estado).detalle }}
                      </div>
                    </div>
                  </li>
                }
              </ol>
              <p class="muted">Esta página se actualiza sola cada 30 segundos.</p>
            </div>
          }

          <div class="panel">
            <h3>Resumen</h3>
            @for (i of p.items; track $index) {
              <div class="row"><span>{{ i.cantidad }} x {{ i.nombre }}@if (i.detalle) {<br><span class="muted">{{ i.detalle }}</span>}</span><span class="spacer"></span><span class="num">{{ i.cantidad * i.precioUnitario | dinero }}</span></div>
            }
            <div class="totals num">
              @if (p.descuento) { <div class="good"><span>{{ p.promocion }}</span><span>−{{ p.descuento | dinero }}</span></div> }
              @if (p.tipoEntrega === 'DOMICILIO') { <div><span>Domicilio</span><span>{{ p.domicilio | dinero }}</span></div> }
              <div class="grand"><span>Total</span><span>{{ p.total | dinero }}</span></div>
            </div>
            <div class="row">
              <span class="st pay-{{ p.estadoPago }}">{{ p.estadoPago === 'RECIBIDO' ? 'Pago recibido' : 'Pago pendiente' }}</span>
              @if (p.metodoPago === 'CUENTA' && p.estadoPago === 'PENDIENTE') {
                <span class="muted">{{ p.cuentaEntidad }} · {{ p.cuentaTitular }}: <b class="num">{{ p.cuentaNumero }}</b></span>
              }
            </div>
          </div>
          <button class="linkbtn" (click)="otro()">Consultar otro pedido</button>
        } @else {
          <h1 style="font-size:32px">¿Por dónde va mi pedido?</h1>
          <p class="muted" style="font-size:15px">Escribe el código que te dimos al pedir (empieza por P-) y el celular con que lo hiciste.</p>

          @if (recientes.length) {
            <div class="panel">
              <span class="lbl">Tus pedidos en este celular</span>
              @for (r of recientes; track r.codigo) {
                <button class="ghost" (click)="consultar(r.codigo, r.celular)">{{ r.codigo }}</button>
              }
            </div>
          }

          <form class="panel" (ngSubmit)="consultar(codigoForm, celularForm)">
            <div class="field"><label for="codigo">Código del pedido</label>
              <input id="codigo" name="codigo" [(ngModel)]="codigoForm" placeholder="P-ABC234" autocapitalize="characters"></div>
            <div class="field"><label for="cel">Celular</label>
              <input id="cel" name="cel" inputmode="tel" [(ngModel)]="celularForm" placeholder="300 123 4567"></div>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <button class="primary" type="submit" [disabled]="cargando()">{{ cargando() ? 'Buscando…' : 'Ver mi pedido' }}</button>
          </form>
          <a class="linkbtn" [routerLink]="emp.url()">Volver al menú</a>
        }
      </section>
    </main>
  `,
})
export class SeguimientoPage implements OnInit {
  private api = inject(TiendaApi);
  private router = inject(Router);
  protected emp = inject(EmpresaActual);

  /** Viene de la ruta /pedido/:codigo */
  readonly codigo = input<string>('');

  protected recientes = pedidosRecientes();
  protected pedido = signal<Seguimiento | null>(null);
  protected cargando = signal(false);
  protected error = signal('');
  protected codigoForm = '';
  protected celularForm = '';
  private celularActual = '';

  protected indice = computed(() => {
    const p = this.pedido();
    return p ? p.flujo.indexOf(p.estado) : -1;
  });

  constructor() {
    const intervalo = setInterval(() => {
      const p = this.pedido();
      if (p && document.visibilityState === 'visible' && p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO') {
        this.api.seguimiento(p.codigo, this.celularActual).subscribe({ next: (s) => this.pedido.set(s), error: () => {} });
      }
    }, 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  ngOnInit(): void {
    const codigo = this.codigo();
    if (!codigo) return;
    this.codigoForm = codigo;
    const conocido = this.recientes.find((r) => r.codigo === codigo);
    if (conocido) this.consultar(conocido.codigo, conocido.celular);
  }

  protected paso(e: EstadoPedido): { titulo: string; detalle: string } {
    return PASOS[e] ?? { titulo: NOMBRE_ESTADO[e], detalle: '' };
  }

  protected nombreEstado(e: EstadoPedido): string {
    return NOMBRE_ESTADO[e];
  }

  protected horaDe(estado: EstadoPedido): string | null {
    const eventos = this.pedido()?.eventos ?? [];
    const e = [...eventos].reverse().find((x) => x.estado === estado);
    return e?.fecha ?? null;
  }

  protected consultar(codigo: string, celular: string): void {
    const c = codigo.trim().toUpperCase();
    const cel = celular.replace(/\D/g, '');
    if (!c || cel.length !== 10) { this.error.set('Escribe el código y un celular de 10 dígitos.'); return; }
    this.cargando.set(true);
    this.error.set('');
    this.api.seguimiento(c, cel).subscribe({
      next: (s) => {
        this.celularActual = cel;
        guardarPedidoReciente(s.codigo, cel);
        this.pedido.set(s);
        this.cargando.set(false);
        if (this.codigo() !== s.codigo) this.router.navigateByUrl(this.emp.url('/pedido/' + encodeURIComponent(s.codigo)), { replaceUrl: true });
      },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }

  protected otro(): void {
    this.pedido.set(null);
    this.recientes = pedidosRecientes();
    this.router.navigateByUrl(this.emp.url('/seguimiento'));
  }
}
