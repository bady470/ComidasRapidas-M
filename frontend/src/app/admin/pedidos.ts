import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Icono } from '../compartido/icono';
import { FormsModule } from '@angular/forms';
import { SelectorProducto, Seleccion } from '../compartido/selector-producto';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { claveLinea } from '../core/carrito';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe, DiaCortoPipe, DineroPipe, HoraPipe, dinero, linkWhatsapp } from '../core/formato';
import { ACCION_HACIA, Domiciliario, EstadoPago, EstadoPedido, MODULOS, MetodoPago, NOMBRE_ESTADO, NOMBRE_PAGO, PedidoAdmin, Producto, TipoEntrega } from '../core/modelos';
import { ImpresionCocina } from '../core/impresion-cocina';
import { EmpresaActual } from '../core/empresa';
import { AvisosPortal } from '../core/avisos-portal';

type Filtro = 'ACTIVOS' | 'POR_PAGAR' | 'TODOS' | EstadoPedido;

interface LineaManual { clave: string; producto: Producto; opcionIds: number[]; detalle: string; cantidad: number; }

@Component({
  selector: 'app-pedidos',
  imports: [Icono, FormsModule, DineroPipe, DiaCortoPipe, HoraPipe, CelularPipe, SelectorProducto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <select aria-label="Día" [ngModel]="fecha()" (ngModelChange)="cambiarFecha($event)">
        <option value="">Todas las fechas</option>
        @for (f of fechas(); track f) { <option [value]="f">{{ f | diaCorto }}</option> }
      </select>
      <input type="search" placeholder="Buscar nombre, celular, código o barrio" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)">
      @if (estadoTienda.tieneModulo(M.pedidoManual)) {
        <button class="btn main" (click)="manualAbierto.set(!manualAbierto())">+ Pedido por WhatsApp o teléfono</button>
      }
    </div>
    <div class="toolbar">
      <div class="seg">
        @for (s of segmentos; track s.k) {
          <button [attr.aria-pressed]="filtro() === s.k" (click)="elegir(s.k)">
            {{ s.t }} @if (conteo()[s.k]) { <span class="num">{{ conteo()[s.k] }}</span> }
          </button>
        }
      </div>
    </div>

    @if (manualAbierto() && tienda(); as t) {
      <form class="editor" (ngSubmit)="guardarManual()">
        <h3>Registrar un pedido que te hicieron por WhatsApp o teléfono</h3>
        <div class="row2">
          <div class="field"><label for="mNombre">Nombre del cliente</label><input id="mNombre" name="mNombre" [(ngModel)]="manual.nombre"></div>
          <div class="field"><label for="mCel">Celular</label><input id="mCel" name="mCel" inputmode="tel" [(ngModel)]="manual.celular"></div>
        </div>
        @if (t.domicilioActivo && t.recogerActivo) {
          <div class="seg-entrega">
            <label><input type="radio" name="mTipo" value="DOMICILIO" [(ngModel)]="manual.tipo"><b>A domicilio</b></label>
            <label><input type="radio" name="mTipo" value="RECOGER" [(ngModel)]="manual.tipo"><b>Recoge en el local</b></label>
          </div>
        }
        @if (manual.tipo === 'DOMICILIO') {
          <div class="row2">
            @if (t.zonas.length) {
              <div class="field"><label for="mZona">Zona</label>
                <select id="mZona" name="mZona" [(ngModel)]="manual.zonaId">
                  <option [ngValue]="null">Sin zona</option>
                  @for (z of t.zonas; track z.id) { <option [ngValue]="z.id">{{ z.nombre }} · {{ z.valor | dinero }}</option> }
                </select></div>
            } @else {
              <div class="field"><label for="mBarrio">Barrio</label><input id="mBarrio" name="mBarrio" [(ngModel)]="manual.barrio"></div>
            }
            <div class="field"><label for="mDir">Dirección</label><input id="mDir" name="mDir" [(ngModel)]="manual.direccion"></div>
          </div>
        }

        <div class="field">
          <span class="flabel">Productos</span>
          @for (l of lineasManual(); track l.clave) {
            <div class="line">
              <div><div class="n">{{ l.producto.nombre }}</div>@if (l.detalle) { <div class="det">{{ l.detalle }}</div> }</div>
              <div class="stepper">
                <button type="button" (click)="cambiarManual(l.clave, -1)" aria-label="Quitar uno">−</button>
                <span class="num">{{ l.cantidad }}</span>
                <button type="button" (click)="cambiarManual(l.clave, 1)" aria-label="Agregar uno">+</button>
              </div>
            </div>
          }
          <div class="row">
            <select aria-label="Producto para agregar" [ngModel]="productoElegido()" (ngModelChange)="productoElegido.set($event)" name="mProd" style="flex:1;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 10px">
              <option [ngValue]="null">Escoge un producto…</option>
              @for (p of productos(); track p.id) { <option [ngValue]="p">{{ p.nombre }} · {{ p.precioHoy | dinero }}</option> }
            </select>
            <button class="btn" type="button" (click)="agregarElegido()" [disabled]="!productoElegido()">Agregar</button>
          </div>
        </div>

        <div class="row2">
          @if (t.modoPedido === 'PROGRAMADO' && t.franjas.length) {
            <div class="field"><label for="mFranja">Hora</label>
              <select id="mFranja" name="mFranja" [(ngModel)]="manual.franja">
                @for (f of t.franjas; track f) { <option [value]="f">{{ f }}</option> }
              </select></div>
          }
          <div class="field"><label for="mPago">Pago</label>
            <select id="mPago" name="mPago" [(ngModel)]="manual.pago">
              @for (n of t.cuentas; track n.id) { <option [value]="'C' + n.id">{{ n.entidad }} · {{ n.titular }}</option> }
              <option value="EFECTIVO">Efectivo</option>
            </select></div>
          <div class="field"><label for="mFecha">Día del pedido</label>
            <input id="mFecha" name="mFecha" type="date" [(ngModel)]="manual.fecha"></div>
        </div>
        <div class="field"><label for="mNotas">Notas</label><input id="mNotas" name="mNotas" [(ngModel)]="manual.notas"></div>
        @if (errorManual()) { <p class="err">{{ errorManual() }}</p> }
        <div class="row"><button class="btn main" type="submit">Guardar pedido</button>
          <button class="btn" type="button" (click)="manualAbierto.set(false)">Cancelar</button></div>
      </form>
    }

    @if (opcionesDe(); as p) {
      <app-selector-producto [producto]="p" (elegido)="agregarManual(p, $event)" (cerrar)="opcionesDe.set(null)" />
    }

    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }
    @if (filtro() === 'POR_PAGAR') {
      <p class="muted" style="margin:-4px 0 12px">Todos los pedidos sin pagar de cualquier día (menos los cancelados). Se quedan aquí hasta que marques el pago.</p>
    }

    <div class="panel tablewrap tabla-datos" style="padding:0">
      <table class="tabla-pedidos">
        <thead>
          <tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th class="r">Total</th><th>Pago</th><th>Estado</th><th class="r">Acción</th></tr>
        </thead>
        @for (p of visibles(); track p.id) {
          <tbody class="pgrupo e-{{ p.estado }}" [class.recien]="recientes().has(p.id)" [class.abierto]="abierto(p)">
            <tr class="fila" (click)="alternar(p.id)">
              <td>
                <button class="desplegar" type="button" [attr.aria-expanded]="abierto(p)" [attr.aria-label]="'Ver detalle del pedido ' + p.codigo" (click)="alternar(p.id); $event.stopPropagation()">{{ abierto(p) ? '▾' : '▸' }}</button>
                <b class="num">{{ p.codigo }}</b>
                @if (p.sede) { <div class="muted">Sede {{ p.sede }}</div> }
                <div class="muted">{{ p.creado | hora }}{{ p.origen === 'WHATSAPP' ? ' · WhatsApp' : '' }}</div>
              </td>
              <td><b>{{ p.clienteNombre }}</b><div class="muted num">{{ p.clienteCelular | celular }}</div></td>
              <td>
                @if (p.tipoEntrega === 'DOMICILIO') {
                  <div>Domicilio · {{ p.zona || p.barrio || 'sin zona' }}</div>
                } @else { <div>Recoge en el local</div> }
                <div class="muted">{{ p.fechaEntrega | diaCorto }}{{ p.franja ? ' · ' + p.franja : '' }}</div>
              </td>
              <td class="r num"><b>{{ p.total | dinero }}</b><div class="muted">{{ p.items.length }} {{ p.items.length === 1 ? 'producto' : 'productos' }}</div></td>
              <td>
                <span class="st pay-{{ p.estadoPago }}">{{ nombrePago(p.estadoPago) }}</span>
                <div class="muted">{{ medioCorto(p) }}</div>
              </td>
              <td>
                <span class="st st-{{ p.estado }}">{{ nombre(p.estado) }}</span>
                @if (p.domiciliarioNombre) { <div class="muted">{{ p.domiciliarioNombre }}</div> }
              </td>
              <td class="r">
                @if (siguiente(p); as s) { <button class="btn main" (click)="estado(p, s); $event.stopPropagation()">{{ accion(s) }}</button> }
                @else if (p.estadoPago === 'POR_CONFIRMAR') { <button class="btn okb" (click)="pago(p, 'RECIBIDO'); $event.stopPropagation()">Confirmar pago</button> }
              </td>
            </tr>
            @if (abierto(p)) {
              <tr class="detalle">
                <td colspan="7">
                  <div class="detalle-grid">
                    <section>
                      <h4>Productos</h4>
                      @for (i of p.items; track $index) {
                        <div class="linea-detalle"><span><b>{{ i.cantidad }} ×</b> {{ i.nombre }}@if (i.detalle) { <span class="muted"> — {{ i.detalle }}</span> }</span></div>
                      }
                      @if (p.promocion) { <div class="linea-detalle"><span class="chip hot">{{ p.promocion }} −{{ p.descuento | dinero }}</span></div> }
                      @if (p.notas) { <p class="meta" style="margin-top:8px"><b>Nota:</b> {{ p.notas }}</p> }
                    </section>
                    <section>
                      <h4>Entrega</h4>
                      @if (p.tipoEntrega === 'DOMICILIO') {
                        <p>{{ p.direccion }}{{ (p.zona || p.barrio) ? ', ' + (p.zona || p.barrio) : '' }}</p>
                        @if (p.referencia) { <p class="muted">{{ p.referencia }}</p> }
                        @if (p.entregaLat != null) {
                          <p><a class="linkbtn" [href]="mapaPedido(p)" target="_blank" rel="noopener"><app-icono nombre="pin" [tam]="15" /> Ver en el mapa{{ p.distanciaKm != null ? ' · a ' + km(p.distanciaKm) + ' km' : '' }}</a></p>
                        }
                        @if (p.estado !== 'CANCELADO') {
                          <div class="row" style="margin-top:8px">
                            <label class="meta" [for]="'dom' + p.id"><b>Domiciliario</b></label>
                            <select [id]="'dom' + p.id" style="width:auto" [ngModel]="p.domiciliarioId" (ngModelChange)="asignar(p, $event)">
                              <option [ngValue]="null">Sin asignar</option>
                              @for (d of domiciliariosPara(p); track d.id) { <option [ngValue]="d.id">{{ d.nombre }}{{ d.activo ? '' : ' (inactivo)' }}</option> }
                            </select>
                            @if (p.domiciliarioCelular) { <a class="btn" [href]="waDomiciliario(p)" target="_blank" rel="noopener">Enviar a {{ p.domiciliarioNombre }}</a> }
                            @if (!domiciliarios().length) { <span class="meta">Agrégalos en «Domiciliarios».</span> }
                          </div>
                        }
                      } @else { <p>El cliente recoge en el local.</p> }
                    </section>
                    <section>
                      <h4>Pago</h4>
                      <p>{{ medioLargo(p) }}</p>
                      <div class="row" style="margin-top:8px">
                        @if (p.tieneComprobante) { <button class="btn" (click)="verComprobante(p)">Ver comprobante</button> }
                        @if (p.estadoPago === 'POR_CONFIRMAR') {
                          <button class="btn okb" (click)="pago(p, 'RECIBIDO')">Confirmar pago</button>
                          <button class="btn bad" (click)="pago(p, 'PENDIENTE')">No llegó el pago</button>
                        } @else if (p.estadoPago === 'PENDIENTE') {
                          <button class="btn okb" (click)="pago(p, 'RECIBIDO')">{{ p.metodoPago === 'EN_LINEA' ? 'Marcar pagado a mano' : 'Marcar pagado' }}</button>
                        } @else {
                          <button class="btn" (click)="pago(p, 'PENDIENTE')">Deshacer pago</button>
                        }
                      </div>
                    </section>
                  </div>
                  <div class="row detalle-acciones">
                    @if (p.clienteCelular) { <a class="btn" [href]="wa(p)" target="_blank" rel="noopener">WhatsApp al cliente</a> }
                    @if (imp.config().modo !== 'APAGADA' && estadoTienda.tieneModulo(M.cocina)) {
                      <button class="btn" type="button" (click)="imp.imprimir(p)"><app-icono nombre="imprimir" /> Imprimir comanda{{ imp.yaImpreso(p.id) ? ' (otra vez)' : '' }}</button>
                    }
                    @if (p.estado !== 'CANCELADO' && p.estado !== 'ENTREGADO') {
                      @if (confirmar() === p.id) {
                        <button class="btn sure" (click)="estado(p, 'CANCELADO')">Sí, cancelar pedido</button>
                        <button class="btn" (click)="confirmar.set(null)">No</button>
                      } @else {
                        <button class="btn bad" (click)="confirmar.set(p.id)">Cancelar pedido</button>
                      }
                    }
                    @if (p.estado === 'CANCELADO') { <button class="btn" (click)="estado(p, 'NUEVO')">Reabrir</button> }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        } @empty {
          <tbody><tr><td colspan="7" class="vacio">{{ cargando() ? 'Cargando pedidos…' : 'No hay pedidos con este filtro.' }}</td></tr></tbody>
        }
      </table>
    </div>
  `,
})
export class PedidosPage {
  private api = inject(AdminApi);
  protected estadoTienda = inject(EstadoTienda);
  protected imp = inject(ImpresionCocina);
  private emp = inject(EmpresaActual);
  protected readonly M = MODULOS;
  private avisos = inject(Avisos);
  private avisosPortal = inject(AvisosPortal);

  /** Llegan desde un aviso: ?q=P-ABC123&filtro=POR_PAGAR */
  readonly q = input<string | undefined>();
  readonly filtroInicial = input<string | undefined>(undefined, { alias: 'filtro' });

  protected domiciliarios = signal<Domiciliario[]>([]);
  /** Pedidos que acaban de cambiar (se resaltan unos segundos). */
  protected recientes = signal<ReadonlySet<number>>(new Set());
  private esperaRecarga: ReturnType<typeof setTimeout> | undefined;

  protected segmentos: { k: Filtro; t: string }[] = [
    { k: 'ACTIVOS', t: 'Activos' }, { k: 'POR_PAGAR', t: 'Por pagar' }, { k: 'NUEVO', t: 'Nuevos' }, { k: 'CONFIRMADO', t: 'Confirmados' },
    { k: 'PREPARANDO', t: 'Preparando' }, { k: 'EN_CAMINO', t: 'En camino' }, { k: 'LISTO', t: 'Para recoger' },
    { k: 'ENTREGADO', t: 'Entregados' }, { k: 'CANCELADO', t: 'Cancelados' }, { k: 'TODOS', t: 'Todos' },
  ];

  protected tienda = computed(() => this.estadoTienda.catalogo()?.tienda ?? null);
  protected productos = computed(() => this.estadoTienda.catalogo()?.productos ?? []);
  protected pedidos = signal<PedidoAdmin[]>([]);
  protected fechasApi = signal<string[]>([]);
  protected fecha = signal<string | null>(null);
  protected filtro = signal<Filtro>('ACTIVOS');
  protected busqueda = signal('');
  protected cargando = signal(true);
  protected error = signal('');
  protected confirmar = signal<number | null>(null);
  private desplegados = signal<ReadonlySet<number>>(new Set());

  /** Un pedido se ve desplegado si se abrió a mano, o si llegó desde un aviso y es el único resultado. */
  protected abierto(p: PedidoAdmin): boolean {
    return this.desplegados().has(p.id) || (!!this.q() && this.visibles().length === 1);
  }
  protected alternar(id: number): void {
    this.desplegados.update((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  }

  protected manualAbierto = signal(false);
  protected errorManual = signal('');
  protected productoElegido = signal<Producto | null>(null);
  protected opcionesDe = signal<Producto | null>(null);
  protected lineasManual = signal<LineaManual[]>([]);
  protected manual = {
    nombre: '', celular: '', tipo: 'DOMICILIO' as TipoEntrega, zonaId: null as number | null, barrio: '',
    direccion: '', franja: '', pago: 'EFECTIVO', fecha: '', notas: '',
  };

  protected fechas = computed(() => {
    const set = new Set(this.fechasApi());
    const hoy = this.tienda()?.fechaServicio;
    if (hoy) set.add(hoy);
    return [...set].sort().reverse();
  });

  private filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.pedidos().filter((p) => !q || `${p.codigo} ${p.clienteNombre} ${p.clienteCelular} ${p.barrio} ${p.zona}`.toLowerCase().includes(q));
  });

  protected conteo = computed(() => {
    const c: Record<string, number> = {};
    for (const p of this.filtrados()) {
      c[p.estado] = (c[p.estado] ?? 0) + 1;
      if (p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO') c['ACTIVOS'] = (c['ACTIVOS'] ?? 0) + 1;
    }
    // «Por pagar» cuenta todos los días, no solo el día escogido.
    c['POR_PAGAR'] = this.avisosPortal.datos()?.porPagar ?? 0;
    return c;
  });

  protected visibles = computed(() => {
    const f = this.filtro();
    return this.filtrados().filter((p) =>
      f === 'TODOS' || f === 'POR_PAGAR' ? true : f === 'ACTIVOS' ? p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO' : p.estado === f);
  });

  private idsVistos = new Set<number>();
  private iniciado = false;

  constructor() {
    this.api.fechas().subscribe((f) => this.fechasApi.set(f));
    this.api.domiciliarios().subscribe({ next: (l) => this.domiciliarios.set(l), error: () => {} });
    // Desde un aviso: busca el pedido y abre el filtro indicado.
    effect(() => {
      const q = this.q();
      const f = this.filtroInicial();
      untracked(() => {
        if (q !== undefined) this.busqueda.set(q);
        if (f && this.segmentos.some((s) => s.k === f) && f !== this.filtro()) this.elegir(f as Filtro);
      });
    });
    // En vivo: cualquier cambio en un pedido (de este u otro administrador, o del cliente) recarga la lista
    // y resalta el pedido que cambió.
    effect(() => {
      const c = this.avisosPortal.cambioPedido();
      if (!c) return;
      untracked(() => {
        if (!this.iniciado) return;
        clearTimeout(this.esperaRecarga);
        this.esperaRecarga = setTimeout(() => this.cargar(true), 250);
        if (c.id) this.resaltar(c.id);
      });
    });
    effect(() => {
      if (this.avisosPortal.cambioDomiciliarios()) untracked(() => this.api.domiciliarios().subscribe({ next: (l) => this.domiciliarios.set(l), error: () => {} }));
    });
    // Arranca apenas se conoce la tienda; los cambios llegan en vivo (y hay una revisión lenta de respaldo).
    effect(() => {
      if (this.tienda() && !this.iniciado) untracked(() => this.iniciar());
    });
    const t = setInterval(() => {
      if (this.iniciado && document.visibilityState === 'visible') this.cargar(true);
    }, 90_000); // respaldo: los cambios llegan en vivo
    inject(DestroyRef).onDestroy(() => { clearInterval(t); clearTimeout(this.esperaRecarga); });
  }

  /** Arranca cuando ya se conoce la tienda (día de servicio, cuentas, franjas). */
  private iniciar(): void {
    const t = this.tienda()!;
    this.iniciado = true;
    if (this.fecha() === null) this.fecha.set(t.fechaServicio);
    this.manual.tipo = t.domicilioActivo ? 'DOMICILIO' : 'RECOGER';
    this.manual.franja = t.franjas[0] ?? '';
    this.manual.pago = t.cuentas[0] ? 'C' + t.cuentas[0].id : 'EFECTIVO';
    this.manual.fecha = t.fechaServicio;
    this.cargar();
  }

  protected cambiarFecha(f: string): void {
    this.fecha.set(f);
    this.idsVistos.clear();
    this.cargar();
  }

  private cargar(silencioso = false): void {
    if (!silencioso) this.cargando.set(true);
    const porPagar = this.filtro() === 'POR_PAGAR';
    this.api.pedidos(porPagar ? { porPagar: true } : { fecha: this.fecha() || undefined }).subscribe({
      next: (lista) => {
        // Los avisos de pedidos nuevos y pagos los muestra el portal (ver core/avisos-portal.ts).
        lista.forEach((p) => this.idsVistos.add(p.id));
        this.pedidos.set(lista);
        this.error.set('');
        this.cargando.set(false);
      },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }

  private resaltar(id: number): void {
    this.recientes.update((s) => new Set([...s, id]));
    setTimeout(() => this.recientes.update((s) => { const n = new Set(s); n.delete(id); return n; }), 4000);
  }

  protected elegir(f: Filtro): void {
    const recargar = (f === 'POR_PAGAR') !== (this.filtro() === 'POR_PAGAR');
    this.filtro.set(f);
    if (recargar && this.iniciado) this.cargar();
  }

  protected nombrePago(e: EstadoPago): string { return NOMBRE_PAGO[e]; }

  /** Activos más el que ya tenga el pedido (aunque lo hayan desactivado). */
  protected domiciliariosPara(p: PedidoAdmin): Domiciliario[] {
    return this.domiciliarios().filter((d) => (d.activo && (d.sedeId == null || p.sedeId == null || d.sedeId === p.sedeId))
      || d.id === p.domiciliarioId);
  }

  protected asignar(p: PedidoAdmin, domiciliarioId: number | null): void {
    this.api.asignarDomiciliario(p.id, domiciliarioId).subscribe({
      next: (n) => { this.reemplazar(n); this.avisos.mostrar(n.domiciliarioNombre ? `${n.codigo} lo lleva ${n.domiciliarioNombre}` : `${n.codigo} sin domiciliario`); },
      error: (e) => { this.avisos.mostrar(mensajeError(e)); this.cargar(true); },
    });
  }

  /** Mensaje para el domiciliario con lo que necesita para la entrega. */
  protected waDomiciliario(p: PedidoAdmin): string {
    const productos = p.items.map((i) => `• ${i.cantidad} x ${i.nombre}${i.detalle ? ' (' + i.detalle + ')' : ''}`).join('\n');
    const cobro = p.estadoPago === 'RECIBIDO' ? 'Ya está pagado.' : p.metodoPago === 'EFECTIVO'
      ? `Cobrar en efectivo: ${dinero(p.total)}`
      : `Pago ${p.metodoPago === 'EN_LINEA' ? 'en línea' : 'por transferencia'} (${NOMBRE_PAGO[p.estadoPago].toLowerCase()}).`;
    const texto = `Hola ${p.domiciliarioNombre}, te toca el pedido ${p.codigo}:\n${productos}\n`
      + `Cliente: ${p.clienteNombre}${p.clienteCelular ? ' · ' + p.clienteCelular : ''}\n`
      + `Dirección: ${p.direccion}${(p.zona || p.barrio) ? ', ' + (p.zona || p.barrio) : ''}${p.referencia ? ' (' + p.referencia + ')' : ''}\n${cobro}`
      + (p.entregaLat != null ? `\nUbicación: ${this.mapaPedido(p)}` : '')
      + (this.linkReparto(p) ? `\nTus pedidos y ubicación: ${this.linkReparto(p)}` : '');
    return linkWhatsapp(p.domiciliarioCelular, texto);
  }

  /** Google Maps en el punto que marcó el cliente (el domiciliario lo abre con un toque). */
  protected mapaPedido(p: PedidoAdmin): string {
    return `https://www.google.com/maps/search/?api=1&query=${p.entregaLat},${p.entregaLng}`;
  }

  protected km(n: number): string { return n.toLocaleString('es-CO', { maximumFractionDigits: 1 }); }

  /** Link de reparto del domiciliario asignado (si la empresa tiene mapas). */
  private linkReparto(p: PedidoAdmin): string {
    if (!this.estadoTienda.tieneModulo(MODULOS.mapas)) return '';
    const d = this.domiciliarios().find((x) => x.id === p.domiciliarioId);
    return d?.token ? location.origin + this.emp.url('/reparto/' + d.token) : '';
  }

  /** Abre el comprobante en otra pestaña (se descarga con el token del portal). */
  protected verComprobante(p: PedidoAdmin): void {
    const ventana = window.open('', '_blank');
    this.api.comprobante(p.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (ventana) ventana.location.href = url; else window.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => { ventana?.close(); this.avisos.mostrar(mensajeError(e)); },
    });
  }

  private reemplazar(p: PedidoAdmin): void {
    this.pedidos.update((l) => l.map((x) => (x.id === p.id ? p : x)));
  }

  protected medioCorto(p: PedidoAdmin): string {
    if (p.metodoPago === 'EN_LINEA') return 'En línea · ' + p.cuentaTitular;
    return p.metodoPago === 'CUENTA' ? p.cuentaEntidad : 'Efectivo';
  }

  protected medioLargo(p: PedidoAdmin): string {
    if (p.metodoPago === 'EN_LINEA') {
      return `Pago en línea con ${p.cuentaTitular}${p.cuentaNumero ? ' · ' + p.cuentaNumero : ''}`
        + (p.estadoPago === 'RECIBIDO' ? ' · confirmado por la pasarela' : ' · esperando que el cliente pague');
    }
    return p.metodoPago === 'CUENTA' ? p.cuentaEntidad + ' · ' + p.cuentaTitular : 'Efectivo';
  }

  protected nombre(e: EstadoPedido): string { return NOMBRE_ESTADO[e]; }
  protected accion(e: EstadoPedido): string { return ACCION_HACIA[e] ?? NOMBRE_ESTADO[e]; }
  protected siguiente(p: PedidoAdmin): EstadoPedido | null {
    const i = p.flujo.indexOf(p.estado);
    return i >= 0 && i < p.flujo.length - 1 ? p.flujo[i + 1]! : null;
  }

  protected wa(p: PedidoAdmin): string {
    const tienda = this.tienda()?.nombre ?? '';
    const texto = p.estado === 'EN_CAMINO' ? `Hola ${p.clienteNombre}, tu pedido ${p.codigo} de ${tienda} ya va en camino.`
      : p.estado === 'LISTO' ? `Hola ${p.clienteNombre}, tu pedido ${p.codigo} de ${tienda} ya está listo para recoger.`
      : `Hola ${p.clienteNombre}, te escribimos de ${tienda} por tu pedido ${p.codigo}.`;
    return linkWhatsapp(p.clienteCelular, texto);
  }

  protected estado(p: PedidoAdmin, destino: EstadoPedido): void {
    this.confirmar.set(null);
    this.api.cambiarEstado(p.id, destino).subscribe({
      next: (n) => { this.reemplazar(n); this.avisos.mostrar(`${p.codigo}: ${NOMBRE_ESTADO[destino]}`); },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  protected pago(p: PedidoAdmin, estadoPago: 'RECIBIDO' | 'PENDIENTE'): void {
    this.api.cambiarPago(p.id, estadoPago).subscribe({
      next: (n) => {
        // En «Por pagar», un pedido pagado sale de la lista.
        if (this.filtro() === 'POR_PAGAR' && n.estadoPago === 'RECIBIDO') this.pedidos.update((l) => l.filter((x) => x.id !== n.id));
        else this.reemplazar(n);
        if (estadoPago === 'RECIBIDO') this.avisos.mostrar('Pago marcado como recibido');
        this.avisosPortal.revisar();
      },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  // ---- Pedido manual
  protected agregarElegido(): void {
    const p = this.productoElegido();
    if (!p) return;
    if (p.grupos.length) this.opcionesDe.set(p);
    else this.agregarManual(p, { productoId: p.id, opcionIds: [], cantidad: 1 });
  }

  protected agregarManual(p: Producto, s: Seleccion): void {
    const clave = claveLinea(p.id, s.opcionIds);
    const detalle = p.grupos.flatMap((g) => g.opciones).filter((o) => s.opcionIds.includes(o.id)).map((o) => o.nombre).join(' · ');
    this.lineasManual.update((l) => {
      const i = l.findIndex((x) => x.clave === clave);
      if (i >= 0) return l.map((x, j) => (j === i ? { ...x, cantidad: x.cantidad + s.cantidad } : x));
      return [...l, { clave, producto: p, opcionIds: s.opcionIds, detalle, cantidad: s.cantidad }];
    });
    this.opcionesDe.set(null);
    this.productoElegido.set(null);
  }

  protected cambiarManual(clave: string, delta: number): void {
    this.lineasManual.update((l) => l.map((x) => (x.clave === clave ? { ...x, cantidad: x.cantidad + delta } : x)).filter((x) => x.cantidad > 0));
  }

  protected guardarManual(): void {
    const m = this.manual;
    const items = this.lineasManual().map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad, opcionIds: l.opcionIds }));
    const cel = m.celular.replace(/\D/g, '');
    if (!m.nombre.trim() || !items.length) { this.errorManual.set('Escribe el nombre y agrega al menos un producto.'); return; }
    if (cel && !/^3\d{9}$/.test(cel)) { this.errorManual.set('El celular debe tener 10 dígitos y empezar por 3.'); return; }
    const metodo: MetodoPago = m.pago === 'EFECTIVO' ? 'EFECTIVO' : 'CUENTA';
    this.api.crearPedidoManual({
      items, tipoEntrega: m.tipo, zonaId: m.tipo === 'DOMICILIO' ? m.zonaId : null, nombre: m.nombre.trim(), celular: cel,
      barrio: m.barrio.trim(), direccion: m.direccion.trim(), franja: m.franja, metodoPago: metodo,
      cuentaId: metodo === 'CUENTA' ? Number(m.pago.slice(1)) : null, fechaEntrega: m.fecha || null, notas: m.notas.trim(),
    }).subscribe({
      next: (p) => {
        this.avisos.mostrar(`Pedido ${p.codigo} guardado · ${dinero(p.total)}`);
        this.manualAbierto.set(false);
        this.errorManual.set('');
        this.lineasManual.set([]);
        Object.assign(this.manual, { nombre: '', celular: '', barrio: '', direccion: '', notas: '', zonaId: null });
        this.idsVistos.add(p.id);
        this.cargar(true);
      },
      error: (e) => this.errorManual.set(mensajeError(e)),
    });
  }
}
