import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { Icono } from '../compartido/icono';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TiendaApi, mensajeError } from '../core/api';
import { EmpresaActual, apiEmpresa } from '../core/empresa';
import { escucharCanal } from '../core/tiempo-real';
import { DiaLargoPipe, DineroPipe, HoraPipe } from '../core/formato';
import { EstadoPedido, NOMBRE_ESTADO, Seguimiento } from '../core/modelos';
import { guardarPedidoReciente, pedidosRecientes } from './recientes';
import { PagarPedido } from '../compartido/pagar-pedido';
import { PagarEnLinea } from '../compartido/pagar-en-linea';
import { Mapa, Marcador } from '../compartido/mapa';
import { Carrito } from '../core/carrito';
import { claveLocal } from '../core/empresa';

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
  imports: [Icono, FormsModule, RouterLink, DineroPipe, DiaLargoPipe, HoraPipe, PagarPedido, PagarEnLinea, Mapa],
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
            @if (p.domiciliarioNombre) {
              <span>Lo lleva <b>{{ p.domiciliarioNombre }}</b>@if (p.domiciliarioCelular) { · <a class="num" [href]="'tel:' + p.domiciliarioCelular">{{ p.domiciliarioCelular }}</a> }</span>
            }
          </div>

          @if (p.estado === 'CANCELADO') {
            <div class="alerta mala">Este pedido fue cancelado. Si crees que es un error, escríbenos por WhatsApp.</div>
          } @else if (!p.enviado) {
            <div class="alerta aviso">
              <b>Tu pedido todavía no se ha enviado.</b> {{ p.metodoPago === 'CUENTA' ? 'Se envía a la tienda apenas adjuntes el comprobante de tu transferencia.' : 'Se envía a la tienda apenas se confirme el pago.' }} Mientras tanto, tus productos siguen en tu carrito.
              <div style="margin-top:10px"><a class="btn" [routerLink]="emp.url('/carrito')">Volver al carrito</a></div>
            </div>
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
              <p class="muted"><span class="en-vivo" [class.off]="!enVivo()">{{ enVivo() ? 'En vivo' : 'Conectando' }}</span>
                Esta página se actualiza sola cuando tu pedido cambia.</p>
            </div>
          }

          @if (marcadores().length && p.estado !== 'CANCELADO' && p.estado !== 'ENTREGADO') {
            <div class="panel">
              <h3>@if (p.mapa?.repartidor) { <app-icono nombre="domiciliarios" /> {{ (p.domiciliarioNombre || 'Tu domiciliario') + ' va en camino' }} } @else { En el mapa }</h3>
              <app-mapa [marcadores]="marcadores()" [alto]="280" etiqueta="Mapa de tu pedido" />
              @if (p.mapa?.repartidor; as r) {
                <span class="hint">Se mueve en vivo · última ubicación {{ haceCuanto(r.actualizado) }}.</span>
              } @else if (p.estado === 'EN_CAMINO') {
                <span class="hint">Cuando el domiciliario comparta su ubicación, lo verás acercarse aquí.</span>
              }
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
              <span class="st pay-{{ p.estadoPago }}">{{ p.estadoPago === 'RECIBIDO' ? 'Pago recibido' : p.estadoPago === 'POR_CONFIRMAR' ? 'Comprobante en revisión' : 'Pago pendiente' }}</span>
              <span class="muted">{{ comoPaga(p) }}</span>
            </div>
          </div>

          @if (verificando()) { <div class="alerta aviso">Revisando tu pago con la pasarela…</div> }
          @if (p.metodoPago === 'EN_LINEA' && p.estado !== 'CANCELADO') {
            <app-pagar-en-linea [codigo]="p.codigo" [celular]="celularActual" [total]="p.total" [estadoPago]="p.estadoPago"
              [intento]="p.pagoEnLinea" [tipoEntrega]="p.tipoEntrega" (cambiado)="pedido.set($event); alPagado($event)" />
          }
          @if (p.metodoPago === 'CUENTA' && p.estadoPago !== 'RECIBIDO' && p.estado !== 'CANCELADO') {
            <app-pagar-pedido [codigo]="p.codigo" [celular]="celularActual" [total]="p.total"
              [entidad]="p.cuentaEntidad" [titular]="p.cuentaTitular" [numero]="p.cuentaNumero"
              [estadoPago]="p.estadoPago" (enviado)="pedido.set($event); alPagado($event)" />
          }
          <button class="linkbtn" (click)="otro()">Consultar otro pedido</button>
        } @else {
          <h1 style="font-size:32px">{{ recientes.length ? 'Mis pedidos' : '¿Por dónde va mi pedido?' }}</h1>
          <p class="muted" style="font-size:15px">{{ recientes.length ? 'Toca un pedido para ver por dónde va.' : 'Escribe el código que te dimos al pedir (empieza por P-) y el celular con que lo hiciste.' }}</p>

          @if (recientes.length) {
            <div class="panel mp">
              <div class="mp-cab">
                <h3>Mis pedidos</h3>
                <span class="muted">{{ visibles().length }} de {{ lista().length }}</span>
              </div>

              <div class="mp-filtros">
                <div class="mp-grupo" role="group" aria-label="Filtrar por estado">
                  @for (f of estados; track f.valor) {
                    <button type="button" class="chip" [class.hot]="estadoSel() === f.valor" [attr.aria-pressed]="estadoSel() === f.valor" (click)="estadoSel.set(f.valor)">{{ f.texto }}</button>
                  }
                </div>
                <div class="mp-grupo" role="group" aria-label="Filtrar por fecha">
                  @for (f of fechas; track f.valor) {
                    <button type="button" class="chip" [class.hot]="fechaSel() === f.valor" [attr.aria-pressed]="fechaSel() === f.valor" (click)="fechaSel.set(f.valor)">{{ f.texto }}</button>
                  }
                </div>
                @if (fechaSel() === 'RANGO') {
                  <div class="mp-rango">
                    <label>Desde <input type="date" [ngModel]="desde()" (ngModelChange)="desde.set($event)" name="desde"></label>
                    <label>Hasta <input type="date" [ngModel]="hasta()" (ngModelChange)="hasta.set($event)" name="hasta"></label>
                  </div>
                }
              </div>

              @if (cargandoLista()) {
                <div class="esqueleto" style="height:84px"></div><div class="esqueleto" style="height:84px"></div>
              } @else {
                @for (p of visibles(); track p.codigo) {
                  <button type="button" class="mp-item" (click)="abrir(p.codigo)">
                    <span class="mp-fila">
                      <b class="mp-codigo">{{ p.codigo }}</b>
                      <span class="st st-{{ p.estado }}">{{ nombreEstado(p.estado) }}</span>
                    </span>
                    <span class="mp-prod">{{ resumenItems(p) }}</span>
                    <span class="mp-fila mp-pie">
                      <span class="muted">{{ fecha(p.creado) }} · {{ p.tipoEntrega === 'RECOGER' ? 'Recoger' : 'Domicilio' }}</span>
                      <span class="spacer"></span>
                      <span class="st pay-{{ p.estadoPago }}">{{ p.estadoPago === 'RECIBIDO' ? 'Pagado' : p.estadoPago === 'POR_CONFIRMAR' ? 'En revisión' : 'Pago pendiente' }}</span>
                      <b class="num">{{ p.total | dinero }}</b>
                    </span>
                  </button>
                } @empty {
                  <div class="empty">Ningún pedido coincide con esos filtros.</div>
                }
                @if (noEncontrados() > 0) {
                  <p class="muted">{{ noEncontrados() }} {{ noEncontrados() === 1 ? 'pedido no se pudo cargar' : 'pedidos no se pudieron cargar' }}; puedes buscarlos abajo con su código.</p>
                }
              }
            </div>
          }

          <form class="panel" (ngSubmit)="consultar(codigoForm, celularForm)">
            @if (recientes.length) { <h3>Buscar otro pedido</h3> }
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
  private carrito = inject(Carrito);

  /** Viene de la ruta /pedido/:codigo */
  readonly codigo = input<string>('');

  protected recientes = pedidosRecientes();
  protected pedido = signal<Seguimiento | null>(null);
  protected cargando = signal(false);
  protected error = signal('');
  protected codigoForm = '';
  protected celularForm = '';
  protected celularActual = '';
  protected verificando = signal(false);
  private ruta = inject(ActivatedRoute);
  /** Revisar el pago en línea apenas cargue el pedido (al volver del checkout). */
  private verificarAlCargar: { transaccion: string | null } | null = null;

  protected indice = computed(() => {
    const p = this.pedido();
    return p ? p.flujo.indexOf(p.estado) : -1;
  });

  /** Canal en vivo del pedido: cada cambio de estado, pago o domiciliario se ve al instante. */
  private canal: { codigo: string; cerrar: () => void } | null = null;
  protected enVivo = signal(false);

  // ---- Lista "Mis pedidos"
  protected readonly estados = [
    { valor: 'TODOS', texto: 'Todos' }, { valor: 'CURSO', texto: 'En curso' },
    { valor: 'ENTREGADO', texto: 'Entregados' }, { valor: 'CANCELADO', texto: 'Cancelados' },
  ] as const;
  protected readonly fechas = [
    { valor: 'TODO', texto: 'Todas las fechas' }, { valor: 'HOY', texto: 'Hoy' }, { valor: '7', texto: '7 días' },
    { valor: '30', texto: '30 días' }, { valor: 'RANGO', texto: 'Elegir fechas' },
  ] as const;
  protected estadoSel = signal<'TODOS' | 'CURSO' | 'ENTREGADO' | 'CANCELADO'>('TODOS');
  protected fechaSel = signal<'TODO' | 'HOY' | '7' | '30' | 'RANGO'>('TODO');
  protected desde = signal('');
  protected hasta = signal('');
  protected lista = signal<Seguimiento[]>([]);
  protected cargandoLista = signal(false);
  protected noEncontrados = signal(0);

  protected visibles = computed(() => {
    const est = this.estadoSel();
    const fe = this.fechaSel();
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    let desde = 0; let hasta = Infinity;
    if (fe === 'HOY') desde = inicioHoy;
    else if (fe === '7') desde = inicioHoy - 6 * 86_400_000;
    else if (fe === '30') desde = inicioHoy - 29 * 86_400_000;
    else if (fe === 'RANGO') {
      if (this.desde()) desde = new Date(this.desde() + 'T00:00:00').getTime();
      if (this.hasta()) hasta = new Date(this.hasta() + 'T23:59:59').getTime();
    }
    return this.lista()
      .filter((p) => est === 'TODOS' || (est === 'CURSO' ? p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO' : p.estado === est))
      .filter((p) => { const t = new Date(p.creado).getTime(); return t >= desde && t <= hasta; })
      .sort((a, b) => new Date(b.creado).getTime() - new Date(a.creado).getTime());
  });

  protected fecha(iso: string): string {
    const f = new Date(iso);
    return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '') + ' · '
      + f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }
  protected resumenItems(p: Seguimiento): string {
    const partes = p.items.slice(0, 2).map((i) => `${i.cantidad} x ${i.nombre}`);
    const mas = p.items.length - 2;
    return partes.join(', ') + (mas > 0 ? ` y ${mas} más` : '');
  }
  protected abrir(codigo: string): void {
    const r = this.recientes.find((x) => x.codigo === codigo);
    if (r) this.consultar(r.codigo, r.celular);
  }

  private cargarLista(): void {
    if (!this.recientes.length) return;
    this.cargandoLista.set(true);
    forkJoin(this.recientes.map((r) => this.api.seguimiento(r.codigo, r.celular).pipe(catchError(() => of(null))))).subscribe((res) => {
      const ok = res.filter((x): x is Seguimiento => !!x);
      this.lista.set(ok);
      this.noEncontrados.set(res.length - ok.length);
      this.cargandoLista.set(false);
    });
  }

  constructor() {
    // Respaldo por si la conexión en vivo no está disponible.
    const intervalo = setInterval(() => this.refrescar(), 60_000);
    inject(DestroyRef).onDestroy(() => { clearInterval(intervalo); this.canal?.cerrar(); });
  }

  private refrescar(): void {
    const p = this.pedido();
    if (p && document.visibilityState === 'visible') {
      this.api.seguimiento(p.codigo, this.celularActual).subscribe({ next: (s) => { this.pedido.set(s); this.alPagado(s); }, error: () => {} });
    }
  }

  private escuchar(codigo: string, celular: string): void {
    if (this.canal?.codigo === codigo) return;
    this.canal?.cerrar();
    const url = `${apiEmpresa()}/public/pedidos/${encodeURIComponent(codigo)}/eventos?celular=${encodeURIComponent(celular)}`;
    this.canal = {
      codigo,
      cerrar: escucharCanal(url, {
        alEvento: (e) => {
          if (e.tipo === 'pedido') this.refrescar();
          // El domiciliario se movió: se actualiza solo su punto en el mapa, sin recargar todo.
          if (e.tipo === 'ubicacion') {
            const d = e.datos as { lat: number; lng: number; t: string };
            this.pedido.update((p) => p && p.mapa ? { ...p, mapa: { ...p.mapa, repartidor: { lat: Number(d.lat), lng: Number(d.lng), actualizado: String(d.t) } } } : p);
          }
        },
        alReconectar: () => this.refrescar(),
      }, (v) => this.enVivo.set(v)),
    };
  }

  ngOnInit(): void {
    const codigo = this.codigo();
    if (!codigo) { this.cargarLista(); return; }
    // Vuelve del checkout de la pasarela (?pago=retorno; Wompi agrega &id=<transacción>): se revisa el pago de una vez.
    const q = this.ruta.snapshot.queryParamMap;
    if (q.get('pago') === 'retorno') this.verificarAlCargar = { transaccion: q.get('id') };
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
        if (s.enviado) guardarPedidoReciente(s.codigo, cel);
        this.pedido.set(s);
        this.alPagado(s);
        this.escuchar(s.codigo, cel);
        this.cargando.set(false);
        const verificar = this.verificarAlCargar;
        this.verificarAlCargar = null;
        if (verificar && s.metodoPago === 'EN_LINEA' && s.estadoPago !== 'RECIBIDO') this.verificar(s.codigo, cel, verificar.transaccion);
        if (this.codigo() !== s.codigo || verificar) {
          this.router.navigateByUrl(this.emp.url('/pedido/' + encodeURIComponent(s.codigo)), { replaceUrl: true });
        }
      },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }

  private verificar(codigo: string, celular: string, transaccion: string | null): void {
    this.verificando.set(true);
    this.api.verificarPago(codigo, celular, transaccion).subscribe({
      next: (s) => { this.pedido.set(s); this.alPagado(s); this.verificando.set(false); },
      error: () => this.verificando.set(false), // el aviso de la pasarela lo confirmará igual
    });
  }

  /** Pago en línea confirmado: ahora sí se vacía el carrito y el pedido pasa a «Mis pedidos». */
  protected alPagado(s: Seguimiento): void {
    if (!s.enviado) return;
    guardarPedidoReciente(s.codigo, this.celularActual);
    const clave = claveLocal('pago_pendiente');
    try {
      if (localStorage.getItem(clave) === s.codigo) { this.carrito.vaciar(); localStorage.removeItem(clave); }
    } catch { /* nada */ }
  }

  protected comoPaga(p: Seguimiento): string {
    if (p.metodoPago === 'CUENTA') return 'Transferencia a ' + p.cuentaEntidad;
    if (p.metodoPago === 'EN_LINEA') return 'En línea · ' + p.cuentaTitular + (p.pagoEnLinea?.medio ? ' · ' + p.pagoEnLinea.medio : '');
    return 'Efectivo';
  }

  /** El local, el punto de entrega y el domiciliario (si está en camino y compartiendo su ubicación). */
  protected marcadores = computed<Marcador[]>(() => {
    const m = this.pedido()?.mapa;
    if (!m) return [];
    const lista: Marcador[] = [];
    if (m.localLat != null && m.localLng != null) lista.push({ id: 'local', lat: m.localLat, lng: m.localLng, tipo: 'local', texto: 'El local' });
    if (m.entregaLat != null && m.entregaLng != null) lista.push({ id: 'destino', lat: m.entregaLat, lng: m.entregaLng, tipo: 'destino', texto: 'Tu entrega' });
    if (m.repartidor) lista.push({ id: 'moto', lat: m.repartidor.lat, lng: m.repartidor.lng, tipo: 'moto', texto: 'Tu domiciliario' });
    return lista.length > 1 || m.repartidor ? lista : [];
  });

  protected haceCuanto(iso: string): string {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    return s < 60 ? 'hace unos segundos' : `hace ${Math.round(s / 60)} min`;
  }

  protected otro(): void {
    this.canal?.cerrar();
    this.canal = null;
    this.pedido.set(null);
    this.recientes = pedidosRecientes();
    this.cargarLista();
    this.router.navigateByUrl(this.emp.url('/seguimiento'));
  }
}
