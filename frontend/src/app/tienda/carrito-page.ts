import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TiendaApi, mensajeError } from '../core/api';
import { Carrito, claveLinea } from '../core/carrito';
import { claveLocal, EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe, DiaLargoPipe, DineroPipe, cuando, diaLargo, dinero, linkWhatsapp } from '../core/formato';
import { Cotizacion, EstadoPago, MetodoPago, PedidoCreado, TipoEntrega } from '../core/modelos';
import { guardarPedidoReciente } from './recientes';
import { PagarPedido } from '../compartido/pagar-pedido';

interface DatosCliente {
  nombre: string; celular: string; barrio: string; direccion: string; referencia: string;
}

const CLAVE_CLIENTE = () => claveLocal('cliente');

@Component({
  selector: 'app-carrito',
  imports: [FormsModule, RouterLink, DineroPipe, DiaLargoPipe, CelularPipe, PagarPedido],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      @if (creado(); as p) {
        <!-- Confirmación -->
        <section class="centro">
          <div style="text-align:center" class="stack">
            <span class="muted">Tu código de pedido</span>
            <span class="code">{{ p.codigo }}</span>
            <span>
              @if (p.modoPedido === 'PROGRAMADO') {
                {{ p.tipoEntrega === 'RECOGER' ? 'Recoges' : 'Te lo llevamos' }} el <b>{{ p.fechaEntrega | diaLargo }}</b>{{ p.franja ? ' · ' + p.franja : '' }}
              } @else {
                {{ p.tipoEntrega === 'RECOGER' ? 'Estará listo para recoger' : 'Llega' }} en unos <b>{{ p.tiempoMin }}–{{ p.tiempoMax }} minutos</b>
              }
            </span>
            @if (p.tipoEntrega === 'RECOGER' && p.direccionTienda) { <span class="muted">Recoges en {{ p.direccionTienda }}</span> }
          </div>
          @if (p.metodoPago === 'CUENTA') {
            <app-pagar-pedido [codigo]="p.codigo" [celular]="celularPedido()" [total]="p.total"
              [entidad]="p.cuentaEntidad" [titular]="p.cuentaTitular" [numero]="p.cuentaNumero"
              [estadoPago]="estadoPago()" (enviado)="estadoPago.set($event.estadoPago)" />
          } @else {
            <div class="panel"><b>Pagas {{ p.total | dinero }} en efectivo {{ p.tipoEntrega === 'RECOGER' ? 'al recoger' : 'al recibir' }}.</b></div>
          }
          @if (p.whatsappTienda) {
            <a class="wa" [href]="linkWa()" target="_blank" rel="noopener">Enviar pedido por WhatsApp</a>
            <p class="muted" style="text-align:center">Si el botón no abre WhatsApp, escríbenos al <b class="num">{{ p.whatsappTienda | celular }}</b>.</p>
          }
          <a class="ghost" [routerLink]="emp.url('/pedido/' + p.codigo)">Ver por dónde va mi pedido</a>
        </section>
      } @else if (!carrito.totalUnidades()) {
        <section class="centro">
          <div class="empty">Tu carrito está vacío.</div>
          <a class="primary" [routerLink]="emp.url()">Ver el menú</a>
        </section>
      } @else {
        @if (tienda(); as t) {
          @if (!t.recibePedidos) {
            <div class="alerta mala" style="margin-top:16px">
              @if (!t.abierto) { Por ahora no estamos recibiendo pedidos. }
              @else { Estamos cerrados.{{ t.proximaApertura ? ' Abrimos ' + texto(t.proximaApertura) + '.' : '' }} Puedes dejar listo tu carrito. }
            </div>
          }
        }
        <div class="checkout">
          <!-- Datos de entrega -->
          <form class="panel" (ngSubmit)="pedir()" novalidate>
            <h3>¿Cómo lo quieres?</h3>
            @if (tienda(); as t) {
              @if (t.domicilioActivo && t.recogerActivo) {
                <div class="seg-entrega" role="radiogroup" aria-label="Tipo de entrega">
                  <label><input type="radio" name="tipo" value="DOMICILIO" [ngModel]="tipo()" (ngModelChange)="tipo.set($event)">
                    <b>A domicilio</b><span class="muted">{{ t.zonas.length ? 'Según tu zona' : (t.domicilioValor ? (t.domicilioValor | dinero) : 'Gratis') }}</span></label>
                  <label><input type="radio" name="tipo" value="RECOGER" [ngModel]="tipo()" (ngModelChange)="tipo.set($event)">
                    <b>Recoger</b><span class="muted">Sin costo de envío</span></label>
                </div>
              }

              @if (tipo() === 'RECOGER') {
                <div class="alerta buena">Recoges en <b>{{ t.direccion }}</b>{{ t.ciudad ? ', ' + t.ciudad : '' }}.</div>
              }
            }

            <div class="field"><label for="nombre">Nombre</label>
              <input id="nombre" name="nombre" autocomplete="name" [(ngModel)]="datos.nombre" placeholder="¿A nombre de quién?"></div>
            <div class="field"><label for="celular">Celular (WhatsApp)</label>
              <input id="celular" name="celular" inputmode="tel" autocomplete="tel" [(ngModel)]="datos.celular" placeholder="300 123 4567"></div>

            @if (tipo() === 'DOMICILIO') {
              @if (tienda()?.zonas?.length) {
                <div class="field"><label for="zona">Zona o barrio</label>
                  <select id="zona" name="zona" [ngModel]="zonaId()" (ngModelChange)="zonaId.set($event)">
                    <option [ngValue]="null" disabled>Escoge tu zona</option>
                    @for (z of tienda()!.zonas; track z.id) { <option [ngValue]="z.id">{{ z.nombre }} · {{ z.valor ? (z.valor | dinero) : 'gratis' }}</option> }
                  </select></div>
              } @else {
                <div class="field"><label for="barrio">Barrio</label>
                  <input id="barrio" name="barrio" [(ngModel)]="datos.barrio" placeholder="Tu barrio"></div>
              }
              <div class="field"><label for="direccion">Dirección</label>
                <input id="direccion" name="direccion" autocomplete="street-address" [(ngModel)]="datos.direccion" placeholder="Calle, carrera, número"></div>
              <div class="field"><label for="referencia">Punto de referencia <span class="hint">(opcional)</span></label>
                <input id="referencia" name="referencia" [(ngModel)]="datos.referencia" placeholder="Casa de rejas verdes, apto 302…"></div>
            }

            @if (tienda()?.modoPedido === 'PROGRAMADO' && tienda()?.franjas?.length) {
              <div class="field"><label for="franja">Hora de {{ tipo() === 'RECOGER' ? 'recogida' : 'entrega' }}</label>
                <select id="franja" name="franja" [(ngModel)]="franja">
                  @for (fr of tienda()!.franjas; track fr) { <option [value]="fr">{{ fr }}</option> }
                </select></div>
            }

            <div class="field">
              <span class="flabel">¿Cómo vas a pagar?</span>
              <div class="opts">
                @for (n of tienda()?.cuentas ?? []; track n.id) {
                  <label class="opt">
                    <input type="radio" name="pago" [value]="'C' + n.id" [(ngModel)]="pago">
                    <span><b>{{ n.entidad }}</b> · {{ n.titular }}<br><span class="muted num">{{ n.numero }}</span></span>
                  </label>
                }
                @if (tienda()?.efectivo) {
                  <label class="opt"><input type="radio" name="pago" value="EFECTIVO" [(ngModel)]="pago">
                    <span><b>Efectivo</b><br><span class="muted">{{ tipo() === 'RECOGER' ? 'Pagas al recoger' : 'Pagas al recibir' }}</span></span></label>
                }
              </div>
            </div>
            <div class="field"><label for="notas">Notas para el pedido <span class="hint">(opcional)</span></label>
              <textarea id="notas" name="notas" [(ngModel)]="notas" placeholder="Ej: sin hielo, tocar el timbre…"></textarea></div>
          </form>

          <!-- Resumen -->
          <aside class="panel sticky">
            <h3>Tu pedido</h3>
            @for (l of cotizacion()?.lineas ?? []; track clave(l.productoId, l.opcionIds)) {
              <div class="line">
                <div>
                  <div class="n">{{ l.nombre }}</div>
                  @if (l.detalle) { <div class="det">{{ l.detalle }}</div> }
                  <div class="muted num">{{ l.precioUnitario | dinero }} c/u</div>
                </div>
                <div class="stepper">
                  <button type="button" (click)="carrito.cambiar(clave(l.productoId, l.opcionIds), -1)" aria-label="Quitar uno">−</button>
                  <span class="num">{{ l.cantidad }}</span>
                  <button type="button" (click)="carrito.cambiar(clave(l.productoId, l.opcionIds), 1)" aria-label="Agregar uno">+</button>
                </div>
              </div>
            }
            @if (faltanCombo(); as f) {
              <div class="alerta aviso">Agrega {{ f.faltan }} {{ f.faltan === 1 ? 'producto más' : 'productos más' }} y aplica «{{ f.nombre }}».</div>
            }
            @if (cotizacion(); as c) {
              <div class="totals num">
                <div><span>Subtotal</span><span>{{ c.subtotalLista | dinero }}</span></div>
                @if (c.ahorroPrecioEspecial) { <div class="good"><span>Precios especiales</span><span>−{{ c.ahorroPrecioEspecial | dinero }}</span></div> }
                @if (c.descuento) { <div class="good"><span>{{ c.promocion }}</span><span>−{{ c.descuento | dinero }}</span></div> }
                @if (tipo() === 'DOMICILIO') {
                  <div><span>Domicilio</span>
                    @if (c.envioGratis) { <span class="good">Gratis</span> }
                    @else if (tienda()?.zonas?.length && zonaId() == null) { <span class="muted">Escoge tu zona</span> }
                    @else { <span>{{ c.domicilio | dinero }}</span> }
                  </div>
                }
                <div class="grand"><span>Total</span><span>{{ c.total | dinero }}</span></div>
              </div>
              @if (faltaMinimo(); as m) { <div class="alerta aviso">El pedido mínimo es de {{ m | dinero }}.</div> }
            }
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <button class="primary" type="button" (click)="pedir()" [disabled]="enviando() || !cotizacion() || !tienda()?.recibePedidos || !!faltaMinimo()">
              {{ enviando() ? 'Enviando pedido…' : (pago.startsWith('C') ? 'Hacer pedido y pagar' : 'Hacer pedido') + (cotizacion() ? ' · ' + precio(cotizacion()!.total) : '') }}
            </button>
            <a class="linkbtn" [routerLink]="emp.url()">Seguir viendo el menú</a>
          </aside>
        </div>
      }
    </main>
  `,
})
export class CarritoPage {
  private api = inject(TiendaApi);
  private estado = inject(EstadoTienda);
  protected carrito = inject(Carrito);
  protected emp = inject(EmpresaActual);

  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);
  protected cotizacion = signal<Cotizacion | null>(null);
  protected creado = signal<PedidoCreado | null>(null);
  /** Celular con que se hizo el pedido (para adjuntar el comprobante) y estado de su pago. */
  protected celularPedido = signal('');
  protected estadoPago = signal<EstadoPago>('PENDIENTE');
  protected enviando = signal(false);
  protected error = signal('');
  protected tipo = signal<TipoEntrega>('DOMICILIO');
  protected zonaId = signal<number | null>(null);

  protected datos: DatosCliente = leerCliente();
  protected franja = '';
  protected pago = '';
  protected notas = '';
  private ultimoMensaje = '';
  private espera: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Recalcula el total en el servidor cuando cambia el carrito, la forma de entrega o la zona.
    effect(() => {
      const items = this.carrito.items();
      const tipo = this.tipo();
      const zona = this.zonaId();
      untracked(() => {
        clearTimeout(this.espera);
        if (!items.length) { this.cotizacion.set(null); return; }
        this.espera = setTimeout(() => this.api.cotizar(items, tipo, zona).subscribe({
          next: (c) => { this.cotizacion.set(c); this.error.set(''); },
          error: (e) => { this.error.set(mensajeError(e)); this.estado.cargar(); },
        }), 200);
      });
    });
    // Valores por defecto cuando llega la información de la tienda.
    effect(() => {
      const t = this.tienda();
      if (!t) return;
      untracked(() => {
        if (!t.domicilioActivo && this.tipo() === 'DOMICILIO') this.tipo.set('RECOGER');
        if (!t.recogerActivo && this.tipo() === 'RECOGER') this.tipo.set('DOMICILIO');
        if (!this.franja) this.franja = t.franjas[0] ?? '';
        if (!this.pago) this.pago = t.cuentas[0] ? 'C' + t.cuentas[0].id : (t.efectivo ? 'EFECTIVO' : '');
      });
    });
  }

  protected faltanCombo = computed(() => {
    const c = this.cotizacion();
    const combo = this.estado.catalogo()?.promociones.find((p) => p.tipo === 'COMBO');
    if (!c || !combo?.cantidad || c.descuento) return null;
    const faltan = (combo.cantidad - (c.cantidadTotal % combo.cantidad)) % combo.cantidad;
    return faltan ? { faltan, nombre: combo.nombre } : null;
  });

  protected faltaMinimo = computed(() => {
    const c = this.cotizacion();
    const minimo = this.tienda()?.pedidoMinimo ?? 0;
    return c && minimo && c.subtotal - c.descuento < minimo ? minimo : 0;
  });

  protected clave(productoId: number, opcionIds: number[]): string { return claveLinea(productoId, opcionIds); }
  protected precio(n: number): string { return dinero(n); }
  protected texto(iso: string): string { return cuando(iso); }

  protected linkWa(): string {
    const p = this.creado();
    return p ? linkWhatsapp(p.whatsappTienda, this.ultimoMensaje) : '#';
  }

  protected pedir(): void {
    const t = this.tienda();
    if (!t) return;
    const d = this.datos;
    const cel = d.celular.replace(/\D/g, '');
    const domicilio = this.tipo() === 'DOMICILIO';
    const faltan: string[] = [];
    if (!d.nombre.trim()) faltan.push('tu nombre');
    if (!/^3\d{9}$/.test(cel)) faltan.push('un celular de 10 dígitos que empiece por 3');
    if (domicilio && t.zonas.length && this.zonaId() == null) faltan.push('tu zona');
    if (domicilio && !t.zonas.length && !d.barrio.trim()) faltan.push('el barrio');
    if (domicilio && !d.direccion.trim()) faltan.push('la dirección');
    if (!this.pago) faltan.push('la forma de pago');
    if (faltan.length) { this.error.set('Falta ' + faltan.join(', ') + '.'); return; }

    const metodo: MetodoPago = this.pago === 'EFECTIVO' ? 'EFECTIVO' : 'CUENTA';
    const cot = this.cotizacion();
    this.enviando.set(true);
    this.error.set('');
    this.api.crearPedido({
      items: this.carrito.items(), tipoEntrega: this.tipo(), zonaId: domicilio ? this.zonaId() : null,
      nombre: d.nombre.trim(), celular: cel, barrio: domicilio ? d.barrio.trim() : '',
      direccion: domicilio ? d.direccion.trim() : '', referencia: domicilio ? d.referencia.trim() : '',
      franja: this.franja, metodoPago: metodo, cuentaId: metodo === 'CUENTA' ? Number(this.pago.slice(1)) : null,
      notas: this.notas.trim(),
    }).subscribe({
      next: (p) => {
        try { localStorage.setItem(CLAVE_CLIENTE(), JSON.stringify({ ...d, celular: cel })); } catch { /* nada */ }
        guardarPedidoReciente(p.codigo, cel);
        this.ultimoMensaje = this.mensaje(p, cot);
        this.celularPedido.set(cel);
        this.estadoPago.set('PENDIENTE');
        this.creado.set(p);
        this.carrito.vaciar();
        this.enviando.set(false);
        window.scrollTo(0, 0);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.enviando.set(false);
        this.estado.cargar(); // por si cambió un precio, se agotó algo o cerró la tienda
      },
    });
  }

  private mensaje(p: PedidoCreado, cot: Cotizacion | null): string {
    const d = this.datos;
    const zona = this.tienda()?.zonas.find((z) => z.id === this.zonaId())?.nombre;
    const lineas = (cot?.lineas ?? []).map((l) => `• ${l.cantidad} x ${l.nombre}${l.detalle ? ' (' + l.detalle + ')' : ''}`).join('\n');
    const entrega = p.modoPedido === 'PROGRAMADO' ? `${diaLargo(p.fechaEntrega)}${p.franja ? ' (' + p.franja + ')' : ''}` : 'lo antes posible';
    const donde = p.tipoEntrega === 'RECOGER' ? 'Recojo en el local'
      : `Dirección: ${d.direccion}, ${zona ?? d.barrio}${d.referencia ? ' (' + d.referencia + ')' : ''}`;
    const pago = p.metodoPago === 'CUENTA' ? `${p.cuentaEntidad} a ${p.cuentaTitular}` : 'Efectivo';
    return `Hola, hice el pedido ${p.codigo}:\n${lineas}\nTotal: ${dinero(p.total)}\nEntrega: ${entrega}\n`
      + `A nombre de: ${d.nombre}\n${donde}\nPago: ${pago}`;
  }
}

function leerCliente(): DatosCliente {
  const vacio: DatosCliente = { nombre: '', celular: '', barrio: '', direccion: '', referencia: '' };
  try { return { ...vacio, ...(JSON.parse(localStorage.getItem(CLAVE_CLIENTE()) ?? '{}') as Partial<DatosCliente>) }; }
  catch { return vacio; }
}
