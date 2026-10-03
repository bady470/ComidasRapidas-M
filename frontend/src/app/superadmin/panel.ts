import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from '../compartido/icono';
import { Logo } from '../compartido/logo';
import { Contar } from '../core/animar';
import { PlataformaApi } from '../core/api';
import { DineroPipe, HoraPipe } from '../core/formato';
import { ConfigCorreo, EmpresaResumen, EstadoEmpresa, NOMBRE_ESTADO_EMPRESA, PasarelaPlataforma, Plan, ResumenPlataforma } from '../core/modelos';
import { SesionSuperadmin } from '../core/sesion';
import { enVivoPlataforma } from './en-vivo';

interface Paso { hecho: boolean; texto: string; nota: string; ruta: string; }

/**
 * Panel del superadmin: cómo va la plataforma de un vistazo. Lo urgente primero (empresas con error o
 * preparándose), luego las cifras del negocio, las empresas nuevas y lo que falta configurar.
 */
@Component({
  selector: 'app-panel-plataforma',
  imports: [RouterLink, Icono, Logo, Contar, DineroPipe, HoraPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="in-hero sa-hero">
      <div class="in-hero-texto">
        <span class="in-fecha">{{ fecha }}</span>
        <h2>{{ saludo }}, {{ nombre() }}</h2>
        <p>{{ frase() }}</p>
        <div class="in-hero-acciones">
          <a class="in-cta" routerLink="/superadmin/empresas/nueva"><app-icono nombre="mas" [tam]="16" /> Crear empresa</a>
          <a class="in-cta sec" routerLink="/superadmin/empresas"><app-icono nombre="empresas" [tam]="16" /> Ver empresas</a>
        </div>
      </div>
      <div class="in-estado" [class.abierta]="vivo.enVivo()">
        <span class="in-estado-punto"></span>
        <div><b>{{ vivo.enVivo() ? 'Conectado en vivo' : 'Reconectando…' }}</b><small>Los cambios de cada empresa llegan al instante.</small></div>
      </div>
    </section>

    <section class="in-kpis sa-kpis" aria-label="Cifras de la plataforma">
      <a class="in-kpi" routerLink="/superadmin/empresas">
        <span class="in-kpi-ico c1"><app-icono nombre="empresas" [tam]="20" /></span>
        <span class="in-kpi-t">Empresas</span>
        <b class="in-kpi-v num"><span [contar]="resumen()?.total ?? 0"></span></b>
        <span class="in-kpi-n">{{ resumen()?.activas ?? 0 }} activas</span>
      </a>
      <div class="in-kpi">
        <span class="in-kpi-ico c4"><app-icono nombre="pagos" [tam]="20" /></span>
        <span class="in-kpi-t">Ingreso mensual por planes</span>
        <b class="in-kpi-v num">{{ ingresoMensual() | dinero }}</b>
        <span class="in-kpi-n">De las empresas activas (los planes anuales, divididos en 12)</span>
      </div>
      <a class="in-kpi" routerLink="/superadmin/empresas" [queryParams]="{ estado: 'preparando' }">
        <span class="in-kpi-ico c2"><app-icono nombre="reloj" [tam]="20" /></span>
        <span class="in-kpi-t">Preparándose</span>
        <b class="in-kpi-v num"><span [contar]="resumen()?.enPreparacion ?? 0"></span></b>
        <span class="in-kpi-n">Base de datos y tienda en camino</span>
      </a>
      <a class="in-kpi" [class.alerta-kpi]="(resumen()?.conError ?? 0) > 0" routerLink="/superadmin/empresas" [queryParams]="{ estado: 'error_aprovisionamiento' }">
        <span class="in-kpi-ico c4"><app-icono nombre="pausa" [tam]="20" /></span>
        <span class="in-kpi-t">Con error</span>
        <b class="in-kpi-v num"><span [contar]="resumen()?.conError ?? 0"></span></b>
        <span class="in-kpi-n">{{ (resumen()?.conError ?? 0) ? 'Revisa y reintenta' : 'Todo en orden' }}</span>
      </a>
    </section>

    <div class="in-dos">
      <div class="in-col">
        <section class="in-card">
          <header class="in-card-h">
            <div><h3>Necesitan tu atención</h3><p class="muted">Empresas con error, preparándose o suspendidas.</p></div>
          </header>
          <ul class="in-pedidos">
            @for (e of atencion(); track e.uuid) {
              <li>
                <a [routerLink]="['/superadmin/empresas', e.uuid]">
                  <app-logo class="sa-logo" [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" />
                  <span class="in-quien"><b>{{ e.nombreComercial }}</b><small class="num">/{{ e.identificador }} · {{ consejo(e.estado) }}</small></span>
                  <span [class]="'st st-' + e.estado">{{ nombreEstado(e.estado) }}</span>
                  <app-icono nombre="flecha" [tam]="16" />
                </a>
              </li>
            } @empty {
              <li class="in-vacio">
                <app-icono nombre="ok" [tam]="28" />
                <b>Todo en orden</b>
                <span class="muted">Ninguna empresa tiene errores ni está esperando.</span>
              </li>
            }
          </ul>
        </section>

        <section class="in-card">
          <header class="in-card-h">
            <div><h3>Empresas recientes</h3><p class="muted">Las últimas que entraron a la plataforma.</p></div>
            <a class="linkbtn" routerLink="/superadmin/empresas">Ver todas</a>
          </header>
          <ul class="in-pedidos">
            @for (e of recientes(); track e.uuid) {
              <li>
                <a [routerLink]="['/superadmin/empresas', e.uuid]">
                  <app-logo class="sa-logo" [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" />
                  <span class="in-quien"><b>{{ e.nombreComercial }}</b><small>{{ nombrePlan(e.plan) }} · creada {{ e.creadoEn | hora }}</small></span>
                  <span [class]="'st st-' + e.estado">{{ nombreEstado(e.estado) }}</span>
                  <b class="in-total num">{{ e.precioPlan | dinero }}</b>
                </a>
              </li>
            } @empty {
              <li class="in-vacio">
                <app-icono nombre="chispa" [tam]="28" />
                <b>Todavía no hay empresas</b>
                <span class="muted">Crea la primera: en unos segundos tiene su base de datos, su tienda y su portal.</span>
                <a class="btn main" routerLink="/superadmin/empresas/nueva">Crear la primera empresa</a>
              </li>
            }
          </ul>
        </section>
      </div>

      <div class="in-col">
        @if (pendientes()) {
          <section class="in-card in-puesta">
            <header class="in-card-h">
              <div><h3>Deja la plataforma lista</h3><p class="muted">{{ hechos() }} de {{ pasos().length }} listos</p></div>
              <span class="in-anillo" [style.--p]="avance()"><b class="num">{{ avance() }}%</b></span>
            </header>
            <ul class="in-pasos">
              @for (p of pasos(); track p.texto) {
                <li [class.hecho]="p.hecho">
                  <a [routerLink]="p.ruta">
                    <span class="in-check">@if (p.hecho) { <app-icono nombre="ok" [tam]="14" /> }</span>
                    <span><b>{{ p.texto }}</b><small>{{ p.nota }}</small></span>
                    @if (!p.hecho) { <app-icono nombre="flecha" [tam]="16" /> }
                  </a>
                </li>
              }
            </ul>
          </section>
        }

        <section class="in-card">
          <header class="in-card-h">
            <div><h3>Empresas por plan</h3><p class="muted">Cuántas hay en cada plan y lo que aportan al mes.</p></div>
            <a class="linkbtn" routerLink="/superadmin/planes">Planes</a>
          </header>
          <div class="sa-planes">
            @for (p of porPlan(); track p.codigo) {
              <div class="sa-plan">
                <div class="sa-plan-t"><b>{{ p.nombre }}</b><span class="muted num">{{ p.cuantas }} · {{ p.ingreso | dinero }}/mes</span></div>
                <div class="sa-barra"><i [style.width.%]="p.porcentaje"></i></div>
              </div>
            } @empty { <p class="muted">Sin planes todavía.</p> }
          </div>
        </section>

        <section class="in-card">
          <header class="in-card-h"><div><h3>Accesos rápidos</h3></div></header>
          <div class="in-atajos">
            <a class="in-atajo" routerLink="/superadmin/empresas/nueva"><span class="in-atajo-ico"><app-icono nombre="nueva" [tam]="20" /></span><b>Nueva empresa</b><small>Lista en segundos</small></a>
            <a class="in-atajo" routerLink="/superadmin/planes"><span class="in-atajo-ico"><app-icono nombre="planes" [tam]="20" /></span><b>Planes</b><small>Precios y módulos</small></a>
            <a class="in-atajo" routerLink="/superadmin/pagos"><span class="in-atajo-ico"><app-icono nombre="pagos" [tam]="20" /></span><b>Pagos en línea</b><small>Cobros y liquidaciones</small></a>
            <a class="in-atajo" routerLink="/superadmin/biblioteca"><span class="in-atajo-ico"><app-icono nombre="biblioteca" [tam]="20" /></span><b>Productos</b><small>Catálogo precargado</small></a>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class PanelPlataformaPage {
  private api = inject(PlataformaApi);
  private sesion = inject(SesionSuperadmin);

  protected resumen = signal<ResumenPlataforma | null>(null);
  protected empresas = signal<EmpresaResumen[]>([]);
  protected planes = signal<Plan[]>([]);
  private correo = signal<ConfigCorreo | null>(null);
  private pasarelas = signal<PasarelaPlataforma[] | null>(null);
  protected vivo: { enVivo: () => boolean };

  protected readonly fecha = (() => {
    const t = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();
  protected readonly saludo = (() => {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).format(new Date())) % 24;
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  })();
  protected nombre = computed(() => (this.sesion.actual()?.nombre ?? '').trim().split(/\s+/)[0] || 'equipo');

  protected frase = computed(() => {
    const r = this.resumen();
    if (!r) return 'Cargando cómo va la plataforma…';
    if (r.conError) return `${r.conError} empresa${r.conError === 1 ? '' : 's'} con error en la preparación: revísala${r.conError === 1 ? '' : 's'} abajo.`;
    if (r.enPreparacion) return `${r.enPreparacion} empresa${r.enPreparacion === 1 ? ' se está' : 's se están'} preparando ahora mismo.`;
    return `${r.activas} empresa${r.activas === 1 ? '' : 's'} activa${r.activas === 1 ? '' : 's'} y todo funcionando.`;
  });

  /** Primero las que tienen error, luego las que se preparan y al final las suspendidas. */
  protected atencion = computed(() => {
    const orden: Partial<Record<EstadoEmpresa, number>> = { error_aprovisionamiento: 0, aprovisionando: 1, pendiente_aprovisionamiento: 2, suspendida: 3 };
    return this.empresas().filter((e) => e.estado !== 'activa').sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9)).slice(0, 6);
  });
  protected recientes = computed(() => [...this.empresas()].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(0, 5));

  /** Lo que pagan al mes las empresas activas (el plan anual cuenta como su doceava parte). */
  protected ingresoMensual = computed(() => this.empresas().filter((e) => e.estado === 'activa')
    .reduce((s, e) => s + (e.cicloFacturacion === 'ANUAL' ? Math.round(e.precioPlan / 12) : e.precioPlan), 0));

  protected porPlan = computed(() => {
    const activas = this.empresas().filter((e) => e.estado === 'activa');
    const filas = this.planes().map((p) => {
      const de = activas.filter((e) => e.plan === p.codigo);
      return { codigo: p.codigo, nombre: p.nombre, cuantas: de.length,
        ingreso: de.reduce((s, e) => s + (e.cicloFacturacion === 'ANUAL' ? Math.round(e.precioPlan / 12) : e.precioPlan), 0) };
    }).filter((f) => f.cuantas || this.planes().find((p) => p.codigo === f.codigo)?.activo);
    const max = Math.max(1, ...filas.map((f) => f.cuantas));
    return filas.map((f) => ({ ...f, porcentaje: Math.round((f.cuantas / max) * 100) }));
  });

  protected pasos = computed<Paso[]>(() => {
    const correo = this.correo();
    const pasarelas = this.pasarelas();
    return [
      { hecho: !!correo?.configurado, texto: 'Configura el correo de envío', nota: 'Para mandar la bienvenida con el usuario y la clave.', ruta: '/superadmin/correo' },
      { hecho: !!pasarelas?.some((p) => p.activa && p.completa), texto: 'Conecta una pasarela de pagos', nota: 'Wompi o Bold, para cobrar en línea.', ruta: '/superadmin/pagos' },
      { hecho: this.planes().some((p) => p.activo), texto: 'Publica al menos un plan', nota: 'Con su precio y sus módulos.', ruta: '/superadmin/planes' },
      { hecho: this.empresas().some((e) => e.estado === 'activa'), texto: 'Crea la primera empresa', nota: 'Su tienda queda lista en segundos.', ruta: '/superadmin/empresas/nueva' },
    ];
  });
  protected hechos = computed(() => this.pasos().filter((p) => p.hecho).length);
  /** Mientras carga no se sabe qué falta: la lista solo aparece cuando ya respondieron correo y pasarelas. */
  protected pendientes = computed(() => this.correo() !== null && this.pasarelas() !== null && this.hechos() < this.pasos().length);
  protected avance = computed(() => Math.round((this.hechos() / this.pasos().length) * 100));

  constructor() {
    this.cargar();
    this.api.planes().subscribe((l) => this.planes.set(l));
    this.api.correo().subscribe({ next: (c) => this.correo.set(c), error: () => this.correo.set({ configurado: false } as ConfigCorreo) });
    this.api.pasarelas().subscribe({ next: (l) => this.pasarelas.set(l), error: () => this.pasarelas.set([]) });
    this.vivo = enVivoPlataforma(() => this.cargar());
  }

  private cargar(): void {
    this.api.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => {} });
    this.api.empresas().subscribe({ next: (l) => this.empresas.set(l), error: () => {} });
  }

  protected nombreEstado(e: EstadoEmpresa): string { return NOMBRE_ESTADO_EMPRESA[e] ?? e; }
  protected nombrePlan(codigo: string | null): string { return this.planes().find((p) => p.codigo === codigo)?.nombre ?? codigo ?? 'Sin plan'; }
  protected consejo(e: EstadoEmpresa): string {
    return e === 'error_aprovisionamiento' ? 'abre y reintenta' : e === 'suspendida' ? 'tienda apagada' : 'en camino';
  }
}
