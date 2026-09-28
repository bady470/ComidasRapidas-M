import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectorProducto, Seleccion } from '../compartido/selector-producto';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { claveLinea } from '../core/carrito';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe, DiaCortoPipe, DineroPipe, HoraPipe, dinero, linkWhatsapp } from '../core/formato';
import { ACCION_HACIA, EstadoPedido, MetodoPago, NOMBRE_ESTADO, PedidoAdmin, Producto, TipoEntrega } from '../core/modelos';

type Filtro = 'ACTIVOS' | 'TODOS' | EstadoPedido;

interface LineaManual { clave: string; producto: Producto; opcionIds: number[]; detalle: string; cantidad: number; }

@Component({
  selector: 'app-pedidos',
  imports: [FormsModule, DineroPipe, DiaCortoPipe, HoraPipe, CelularPipe, SelectorProducto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <select aria-label="Día" [ngModel]="fecha()" (ngModelChange)="cambiarFecha($event)">
        <option value="">Todas las fechas</option>
        @for (f of fechas(); track f) { <option [value]="f">{{ f | diaCorto }}</option> }
      </select>
      <input type="search" placeholder="Buscar nombre, celular, código o barrio" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)">
      <button class="btn main" (click)="manualAbierto.set(!manualAbierto())">+ Pedido por WhatsApp o teléfono</button>
    </div>
    <div class="toolbar">
      <div class="seg">
        @for (s of segmentos; track s.k) {
          <button [attr.aria-pressed]="filtro() === s.k" (click)="filtro.set(s.k)">
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

    <div class="aorders">
      @for (p of visibles(); track p.id) {
        <article class="aorder e-{{ p.estado }}">
          <div class="hd">
            <div class="stack" style="gap:2px">
              <b style="font-size:16px">{{ p.clienteNombre }} · <span class="num">{{ p.codigo }}</span></b>
              @if (p.tipoEntrega === 'DOMICILIO') {
                <span class="meta">{{ p.direccion }}{{ (p.zona || p.barrio) ? ', ' + (p.zona || p.barrio) : '' }}{{ p.referencia ? ' · ' + p.referencia : '' }}</span>
              } @else {
                <span class="meta"><b>Recoge en el local</b></span>
              }
              <span class="meta num">{{ p.clienteCelular | celular }} · {{ p.fechaEntrega | diaCorto }}{{ p.franja ? ' · ' + p.franja : '' }}
                · pedido {{ p.creado | hora }}{{ p.origen === 'WHATSAPP' ? ' · por WhatsApp' : '' }}</span>
            </div>
            <div class="stack" style="gap:6px;justify-items:end">
              <b class="price num" style="font-size:20px">{{ p.total | dinero }}</b>
              <span class="st st-{{ p.estado }}">{{ nombre(p.estado) }}</span>
            </div>
          </div>
          <div class="stack" style="gap:4px">
            @for (i of p.items; track $index) {
              <div class="meta"><b>{{ i.cantidad }} x {{ i.nombre }}</b>{{ i.detalle ? ' — ' + i.detalle : '' }}</div>
            }
            @if (p.promocion) { <div><span class="chip hot">{{ p.promocion }} −{{ p.descuento | dinero }}</span></div> }
          </div>
          @if (p.notas) { <p class="meta">Nota: {{ p.notas }}</p> }
          <div class="row">
            <span class="st pay-{{ p.estadoPago }}">{{ p.metodoPago === 'CUENTA' ? p.cuentaEntidad + ' ' + p.cuentaTitular : 'Efectivo' }} · {{ p.estadoPago === 'RECIBIDO' ? 'pagado' : 'sin pagar' }}</span>
            @if (p.estadoPago === 'PENDIENTE') {
              <button class="btn okb" (click)="pago(p, 'RECIBIDO')">Marcar pagado</button>
            } @else {
              <button class="btn" (click)="pago(p, 'PENDIENTE')">Deshacer pago</button>
            }
            @if (siguiente(p); as s) { <button class="btn main" (click)="estado(p, s)">{{ accion(s) }}</button> }
            @if (p.clienteCelular) { <a class="btn" [href]="wa(p)" target="_blank" rel="noopener">WhatsApp</a> }
            @if (p.estado !== 'CANCELADO' && p.estado !== 'ENTREGADO') {
              @if (confirmar() === p.id) {
                <button class="btn sure" (click)="estado(p, 'CANCELADO')">Sí, cancelar</button>
                <button class="btn" (click)="confirmar.set(null)">No</button>
              } @else {
                <button class="btn bad" (click)="confirmar.set(p.id)">Cancelar</button>
              }
            }
            @if (p.estado === 'CANCELADO') { <button class="btn" (click)="estado(p, 'NUEVO')">Reabrir</button> }
          </div>
        </article>
      } @empty {
        <div class="empty">{{ cargando() ? 'Cargando pedidos…' : 'No hay pedidos con este filtro.' }}</div>
      }
    </div>
  `,
})
export class PedidosPage {
  private api = inject(AdminApi);
  private estadoTienda = inject(EstadoTienda);
  private avisos = inject(Avisos);

  protected segmentos: { k: Filtro; t: string }[] = [
    { k: 'ACTIVOS', t: 'Activos' }, { k: 'NUEVO', t: 'Nuevos' }, { k: 'CONFIRMADO', t: 'Confirmados' },
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
    return c;
  });

  protected visibles = computed(() => {
    const f = this.filtro();
    return this.filtrados().filter((p) =>
      f === 'TODOS' ? true : f === 'ACTIVOS' ? p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO' : p.estado === f);
  });

  private idsVistos = new Set<number>();
  private iniciado = false;

  constructor() {
    this.api.fechas().subscribe((f) => this.fechasApi.set(f));
    // Arranca apenas se conoce la tienda y luego revisa pedidos nuevos cada 30 segundos.
    effect(() => {
      if (this.tienda() && !this.iniciado) untracked(() => this.iniciar());
    });
    const t = setInterval(() => {
      if (this.iniciado && document.visibilityState === 'visible') this.cargar(true);
    }, 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
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
    this.api.pedidos({ fecha: this.fecha() || undefined }).subscribe({
      next: (lista) => {
        const nuevos = lista.filter((p) => !this.idsVistos.has(p.id));
        if (silencioso && this.idsVistos.size && nuevos.some((p) => p.estado === 'NUEVO')) this.avisos.mostrar('Llegó un pedido nuevo');
        lista.forEach((p) => this.idsVistos.add(p.id));
        this.pedidos.set(lista);
        this.error.set('');
        this.cargando.set(false);
      },
      error: (e) => { this.error.set(mensajeError(e)); this.cargando.set(false); },
    });
  }

  private reemplazar(p: PedidoAdmin): void {
    this.pedidos.update((l) => l.map((x) => (x.id === p.id ? p : x)));
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
      next: (n) => { this.reemplazar(n); if (estadoPago === 'RECIBIDO') this.avisos.mostrar('Pago marcado como recibido'); },
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
