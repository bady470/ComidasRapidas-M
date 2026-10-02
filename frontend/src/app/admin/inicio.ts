import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GraficaColumnas, Punto, compacto } from '../compartido/graficas';
import { Icono } from '../compartido/icono';
import { AdminApi } from '../core/api';
import { Avisos } from '../core/avisos';
import { AvisosPortal } from '../core/avisos-portal';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { DineroPipe, HoraPipe, cuando, diaLargo, dinero } from '../core/formato';
import { EstadoPedido, MODULOS, NOMBRE_ESTADO, PedidoAdmin } from '../core/modelos';
import { SesionAdmin } from '../core/sesion';

interface Atajo { ruta: string; texto: string; nota: string; icono: string; }
interface Paso { hecho: boolean; texto: string; nota: string; ruta: string; }

/** Pasos del pedido que se ven en el tablero, en el orden en que avanza. */
const FLUJO: EstadoPedido[] = ['NUEVO', 'CONFIRMADO', 'PREPARANDO', 'EN_CAMINO', 'LISTO'];

function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}
function sumarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Inicio del portal: lo primero que ve el administrador al entrar. Cuenta cómo va el día de un vistazo
 * (ventas, pedidos en curso, pagos pendientes), lleva a lo que más se usa y guía la puesta a punto de la tienda.
 */
@Component({
  selector: 'app-inicio-admin',
  imports: [RouterLink, Icono, DineroPipe, HoraPipe, GraficaColumnas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="in-hero">
      <div class="in-hero-texto">
        <span class="in-fecha">{{ fechaLarga() }}</span>
        <h2>{{ saludo() }}, {{ nombre() }}</h2>
        <p>{{ frase() }}</p>
        <div class="in-hero-acciones">
          <a class="in-cta" routerLink="../pedidos">Ver pedidos <app-icono nombre="flecha" [tam]="16" /></a>
          <a class="in-cta sec" [href]="emp.url()" target="_blank" rel="noopener"><app-icono nombre="externo" [tam]="16" /> Abrir mi tienda</a>
          <button class="in-cta sec" type="button" (click)="copiarLink()"><app-icono nombre="copiar" [tam]="16" /> Copiar link</button>
        </div>
      </div>
      @if (tienda(); as t) {
        <div class="in-estado" [class.abierta]="t.recibePedidos">
          <span class="in-estado-punto"></span>
          <div>
            <b>{{ t.recibePedidos ? 'Tu tienda está recibiendo pedidos' : 'Tu tienda está cerrada' }}</b>
            <small>{{ t.recibePedidos ? 'Los clientes pueden pedir ahora mismo.' : t.proximaApertura ? 'Abre ' + abre(t.proximaApertura) + '.' : 'Revisa el horario en Mi tienda.' }}</small>
          </div>
        </div>
      }
    </section>

    <section class="in-kpis" aria-label="Resumen de hoy">
      <article class="in-kpi">
        <span class="in-kpi-ico c1"><app-icono nombre="pagos" [tam]="20" /></span>
        <span class="in-kpi-t">Ventas de hoy</span>
        <b class="in-kpi-v num">{{ cargando() ? '—' : (ventasHoy() | dinero) }}</b>
        <span class="in-kpi-n">{{ ticket() ? 'Ticket promedio ' + plata(ticket()) : 'Aún sin ventas hoy' }}</span>
      </article>
      <article class="in-kpi">
        <span class="in-kpi-ico c2"><app-icono nombre="pedidos" [tam]="20" /></span>
        <span class="in-kpi-t">Pedidos de hoy</span>
        <b class="in-kpi-v num">{{ cargando() ? '—' : validos().length }}</b>
        <span class="in-kpi-n">{{ entregados() }} entregado{{ entregados() === 1 ? '' : 's' }}{{ cancelados() ? ' · ' + cancelados() + ' cancelado' + (cancelados() === 1 ? '' : 's') : '' }}</span>
      </article>
      <a class="in-kpi" routerLink="../pedidos">
        <span class="in-kpi-ico c3"><app-icono nombre="llama" [tam]="20" /></span>
        <span class="in-kpi-t">En curso ahora</span>
        <b class="in-kpi-v num">{{ cargando() ? '—' : activos().length }}</b>
        <span class="in-kpi-n">{{ nuevos() ? nuevos() + ' esperando confirmación' : 'Nada esperando' }}</span>
      </a>
      <a class="in-kpi" [class.alerta-kpi]="porPagar() > 0" routerLink="../pedidos" [queryParams]="{ filtro: 'POR_PAGAR' }">
        <span class="in-kpi-ico c4"><app-icono nombre="efectivo" [tam]="20" /></span>
        <span class="in-kpi-t">Por cobrar</span>
        <b class="in-kpi-v num">{{ porPagar() }}</b>
        <span class="in-kpi-n">{{ porPagar() ? 'Pedido' + (porPagar() === 1 ? '' : 's') + ' sin pago confirmado' : 'Todo cobrado' }}</span>
      </a>
    </section>

    <div class="in-dos">
      <section class="in-card">
        <header class="in-card-h">
          <div><h3>Pedidos en curso</h3><p class="muted">Toca un paso para ver esos pedidos.</p></div>
          @if (avisos.enVivo()) { <span class="en-vivo">En vivo</span> }
        </header>
        <ol class="in-flujo">
          @for (e of flujo(); track e.estado) {
            <li>
              <a [routerLink]="'../pedidos'" [queryParams]="{ filtro: e.estado }" class="in-paso e-{{ e.estado }}" [class.vacio]="!e.cantidad">
                <b class="num">{{ e.cantidad }}</b>
                <span>{{ e.nombre }}</span>
              </a>
            </li>
          }
        </ol>

        <div class="in-lista-h">
          <h4>Últimos pedidos</h4>
          <a class="linkbtn" routerLink="../pedidos">Ver todos</a>
        </div>
        @if (cargando()) {
          @for (i of [1, 2, 3]; track i) { <div class="esqueleto" style="height:58px"></div> }
        } @else {
          <ul class="in-pedidos">
            @for (p of ultimos(); track p.id) {
              <li>
                <a routerLink="../pedidos" [queryParams]="{ q: p.codigo }">
                  <span class="in-av" aria-hidden="true">{{ inicial(p.clienteNombre) }}</span>
                  <span class="in-quien">
                    <b>{{ p.clienteNombre || 'Cliente' }}</b>
                    <small class="num">{{ p.codigo }} · {{ p.creado | hora }} · {{ p.tipoEntrega === 'DOMICILIO' ? 'Domicilio' : 'Recoge' }}</small>
                  </span>
                  <span class="st st-{{ p.estado }}">{{ nombreEstado[p.estado] }}</span>
                  <b class="in-total num">{{ p.total | dinero }}</b>
                </a>
              </li>
            } @empty {
              <li class="in-vacio">
                <app-icono nombre="chispa" [tam]="28" />
                <b>Todavía no hay pedidos hoy</b>
                <span class="muted">Comparte el link de tu tienda por WhatsApp e Instagram para recibir los primeros.</span>
                <button class="btn main" type="button" (click)="copiarLink()"><app-icono nombre="copiar" /> Copiar link de la tienda</button>
              </li>
            }
          </ul>
        }
      </section>

      <div class="in-col">
        @if (pasosPendientes()) {
          <section class="in-card in-puesta">
            <header class="in-card-h">
              <div><h3>Deja tu tienda a punto</h3><p class="muted">{{ pasosHechos() }} de {{ pasos().length }} listos</p></div>
              <span class="in-anillo" [style.--p]="avance()"><b class="num">{{ avance() }}%</b></span>
            </header>
            <ul class="in-pasos">
              @for (p of pasos(); track p.texto) {
                <li [class.hecho]="p.hecho">
                  <a [routerLink]="'../' + p.ruta">
                    <span class="in-check">@if (p.hecho) { <app-icono nombre="ok" [tam]="14" /> }</span>
                    <span><b>{{ p.texto }}</b><small>{{ p.nota }}</small></span>
                    @if (!p.hecho) { <app-icono nombre="flecha" [tam]="16" /> }
                  </a>
                </li>
              }
            </ul>
          </section>
        }

        @if (semana(); as s) {
          <section class="in-card">
            <header class="in-card-h">
              <div><h3>Ventas de los últimos 7 días</h3><p class="muted num">{{ totalSemana() | dinero }} en {{ pedidosSemana() }} pedidos</p></div>
              <a class="linkbtn" routerLink="../estadisticas">Más</a>
            </header>
            <app-grafica-columnas [puntos]="s" [formato]="formatoDinero" [alto]="170" />
          </section>
        }

        <section class="in-card">
          <header class="in-card-h"><div><h3>Accesos rápidos</h3></div></header>
          <div class="in-atajos">
            @for (a of atajos(); track a.ruta) {
              <a class="in-atajo" [routerLink]="'../' + a.ruta">
                <span class="in-atajo-ico"><app-icono [nombre]="a.icono" [tam]="20" /></span>
                <b>{{ a.texto }}</b>
                <small>{{ a.nota }}</small>
              </a>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class InicioAdminPage {
  private api = inject(AdminApi);
  private estado = inject(EstadoTienda);
  private sesion = inject(SesionAdmin);
  private toast = inject(Avisos);
  protected avisos = inject(AvisosPortal);
  protected emp = inject(EmpresaActual);
  protected readonly nombreEstado = NOMBRE_ESTADO;
  protected readonly formatoDinero = (n: number) => dinero(n);

  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);
  protected pedidos = signal<PedidoAdmin[]>([]);
  protected cargando = signal(true);
  protected semana = signal<Punto[] | null>(null);

  protected nombre = computed(() => (this.sesion.actual()?.nombre ?? '').trim().split(/\s+/)[0] || 'equipo');
  protected fechaLarga = computed(() => {
    const t = diaLargo(hoyISO());
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  protected saludo = computed(() => {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).format(new Date())) % 24;
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  });

  protected validos = computed(() => this.pedidos().filter((p) => p.estado !== 'CANCELADO'));
  protected activos = computed(() => this.validos().filter((p) => p.estado !== 'ENTREGADO'));
  protected nuevos = computed(() => this.pedidos().filter((p) => p.estado === 'NUEVO').length);
  protected entregados = computed(() => this.pedidos().filter((p) => p.estado === 'ENTREGADO').length);
  protected cancelados = computed(() => this.pedidos().filter((p) => p.estado === 'CANCELADO').length);
  protected ventasHoy = computed(() => this.validos().reduce((s, p) => s + p.total, 0));
  protected ticket = computed(() => (this.validos().length ? Math.round(this.ventasHoy() / this.validos().length) : 0));
  protected porPagar = computed(() => this.avisos.datos()?.porPagar ?? 0);
  protected ultimos = computed(() => [...this.pedidos()].sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 6));

  protected frase = computed(() => {
    if (this.cargando()) return 'Estamos preparando el resumen de tu día…';
    const n = this.nuevos(), a = this.activos().length;
    if (n) return `Tienes ${n} pedido${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'} esperando que lo${n === 1 ? '' : 's'} confirmes.`;
    if (a) return `Hay ${a} pedido${a === 1 ? '' : 's'} en marcha. ¡Vas muy bien!`;
    if (this.validos().length) return `Llevas ${dinero(this.ventasHoy())} en ventas hoy. Todo al día.`;
    return 'Aquí verás cómo va tu negocio hoy, en tiempo real.';
  });

  /** Solo los pasos que usa la tienda: «Para recoger» aparece si se ofrece recoger en el local. */
  protected flujo = computed(() => {
    const recoger = this.tienda()?.recogerActivo ?? true;
    return FLUJO.filter((e) => e !== 'LISTO' || recoger).map((e) => ({
      estado: e,
      nombre: e === 'LISTO' ? 'Para recoger' : NOMBRE_ESTADO[e],
      cantidad: this.pedidos().filter((p) => p.estado === e).length,
    }));
  });

  protected pasos = computed<Paso[]>(() => {
    const c = this.estado.catalogo();
    if (!c) return [];
    const t = c.tienda;
    return [
      { hecho: !!t.logoUrl, texto: 'Sube tu logo', nota: 'Tus clientes te reconocen al instante.', ruta: 'tienda' },
      { hecho: c.productos.length >= 3, texto: 'Agrega tus productos', nota: c.productos.length ? `Tienes ${c.productos.length}; con fotos venden más.` : 'Con foto, precio y descripción.', ruta: 'productos' },
      { hecho: !!t.whatsapp, texto: 'Conecta tu WhatsApp', nota: 'Para que te escriban con un toque.', ruta: 'tienda' },
      { hecho: t.efectivo || t.cuentas.length > 0 || !!t.pagoEnLinea, texto: 'Elige cómo te pagan', nota: 'Efectivo, transferencia o en línea.', ruta: 'tienda' },
      { hecho: t.horarios.length > 0, texto: 'Define tu horario', nota: 'La tienda abre y cierra sola.', ruta: 'tienda' },
    ];
  });
  protected pasosHechos = computed(() => this.pasos().filter((p) => p.hecho).length);
  protected pasosPendientes = computed(() => this.pasos().length - this.pasosHechos());
  protected avance = computed(() => (this.pasos().length ? Math.round((this.pasosHechos() / this.pasos().length) * 100) : 0));

  protected atajos = computed<Atajo[]>(() => {
    const tiene = (m: string) => this.estado.tieneModulo(m);
    return [
      { ruta: 'productos', texto: 'Productos', nota: 'Precios, fotos y agotados', icono: 'productos' },
      ...(tiene(MODULOS.promociones) ? [
        { ruta: 'promociones', texto: 'Promociones', nota: 'Descuentos y combos', icono: 'promociones' },
        { ruta: 'banners', texto: 'Banners', nota: 'La vitrina de tu tienda', icono: 'imagen' },
      ] : []),
      { ruta: 'plantillas', texto: 'Plantillas', nota: 'Cambia el look de tu tienda', icono: 'plantilla' },
      { ruta: 'tienda', texto: 'Mi tienda', nota: 'Logo, colores y horario', icono: 'tienda' },
      { ruta: 'domiciliarios', texto: 'Domiciliarios', nota: 'Quién lleva los pedidos', icono: 'domiciliarios' },
      ...(tiene(MODULOS.reportes) ? [{ ruta: 'estadisticas', texto: 'Estadísticas', nota: 'Cómo va tu negocio', icono: 'estadisticas' }] : []),
      ...(tiene(MODULOS.clientes) ? [{ ruta: 'clientes', texto: 'Clientes', nota: 'Quién te compra más', icono: 'clientes' }] : []),
      ...(tiene(MODULOS.caja) ? [{ ruta: 'caja', texto: 'Cierre de caja', nota: 'Cuadra el día', icono: 'caja' }] : []),
    ].slice(0, 6);
  });

  protected totalSemana = computed(() => (this.semana() ?? []).reduce((s, p) => s + p.valor, 0));
  protected pedidosSemana = signal(0);

  private fechaCargada = '';

  constructor() {
    // Los pedidos son los del día de servicio de la tienda (puede ser mañana si se pide con anticipación).
    effect(() => {
      const t = this.tienda();
      if (!t) return;
      untracked(() => {
        if (this.fechaCargada !== t.fechaServicio) { this.fechaCargada = t.fechaServicio; this.cargar(); }
        if (this.semana() === null && this.estado.tieneModulo(MODULOS.reportes)) this.cargarSemana();
      });
    });
    // Un pedido nuevo o un cambio de estado llega en vivo: se refresca el resumen.
    effect(() => {
      if (this.avisos.cambioPedido() && this.fechaCargada) untracked(() => this.cargar());
    });
  }

  private cargar(): void {
    this.api.pedidos({ fecha: this.fechaCargada }).subscribe({
      next: (l) => { this.pedidos.set(l); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  private cargarSemana(): void {
    const hasta = hoyISO();
    this.api.estadisticas(sumarDias(hasta, -6), hasta).subscribe({
      next: (e) => {
        this.pedidosSemana.set(e.actual.pedidos);
        this.semana.set(e.dias.map((d) => {
          const f = new Date(d.fecha + 'T12:00:00');
          const dia = f.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
          return { etiqueta: dia.charAt(0).toUpperCase() + dia.slice(1), valor: d.ventas, detalle: `${d.pedidos} pedido${d.pedidos === 1 ? '' : 's'}` };
        }));
      },
      error: () => {},
    });
  }

  protected inicial(nombre: string): string { return (nombre.trim()[0] ?? '?').toUpperCase(); }
  protected plata(n: number): string { return compacto(n); }
  protected abre(iso: string): string { return cuando(iso); }

  protected copiarLink(): void {
    const link = location.origin + this.emp.url();
    navigator.clipboard?.writeText(link).then(
      () => this.toast.mostrar('Link copiado. ¡Compártelo con tus clientes!'),
      () => this.toast.mostrar(link),
    );
  }
}
