import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icono } from '../compartido/icono';
import { Logo } from '../compartido/logo';
import { PlataformaApi, mensajeError } from '../core/api';
import { enVivoPlataforma } from './en-vivo';
import { DineroPipe, HoraPipe } from '../core/formato';
import { EmpresaResumen, Plan, EstadoEmpresa, NOMBRE_ESTADO_EMPRESA } from '../core/modelos';

/** «preparando» agrupa las que están en cola y las que se están aprovisionando. */
type FiltroEstado = 'todas' | 'activa' | 'preparando' | 'suspendida' | 'error_aprovisionamiento';
type Orden = 'recientes' | 'nombre' | 'precio';

const FILTROS: { k: FiltroEstado; t: string }[] = [
  { k: 'todas', t: 'Todas' }, { k: 'activa', t: 'Activas' }, { k: 'preparando', t: 'Preparando' },
  { k: 'suspendida', t: 'Suspendidas' }, { k: 'error_aprovisionamiento', t: 'Con error' },
];

/** Todas las empresas de la plataforma: buscar, filtrar por estado o plan y entrar a cada una. */
@Component({
  selector: 'app-empresas',
  imports: [FormsModule, RouterLink, Icono, Logo, HoraPipe, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sa-filtros">
      <div class="seg" role="group" aria-label="Filtrar por estado">
        @for (f of filtros; track f.k) {
          <button type="button" [attr.aria-pressed]="filtro() === f.k" (click)="filtro.set(f.k)">
            {{ f.t }} <span class="num">{{ conteo()[f.k] }}</span>
          </button>
        }
      </div>
    </div>

    <div class="toolbar">
      <input type="search" placeholder="Buscar por nombre, identificador, razón social o dominio" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" aria-label="Buscar empresa">
      <select aria-label="Plan" [ngModel]="plan()" (ngModelChange)="plan.set($event)">
        <option value="">Todos los planes</option>
        @for (p of planes(); track p.codigo) { <option [value]="p.codigo">{{ p.nombre }}</option> }
      </select>
      <select aria-label="Ordenar" [ngModel]="orden()" (ngModelChange)="orden.set($event)">
        <option value="recientes">Más recientes</option>
        <option value="nombre">Nombre (A–Z)</option>
        <option value="precio">Mayor precio</option>
      </select>
      <span class="en-vivo" [class.off]="!vivo.enVivo()">{{ vivo.enVivo() ? 'En vivo' : 'Reconectando' }}</span>
    </div>

    @if (error()) { <div class="alerta mala">{{ error() }}</div> }

    @if (cargado() && !empresas().length) {
      <div class="empty">
        <b>Todavía no hay empresas</b>
        <p class="muted">Crea la primera: se prepara su base de datos, su tienda y su portal de pedidos.</p>
        <div><a class="btn main" routerLink="/superadmin/empresas/nueva">Crear la primera empresa</a></div>
      </div>
    } @else if (!cargado()) {
      @for (i of [1, 2, 3]; track i) { <div class="esqueleto" style="height:64px"></div> }
    } @else {
      <p class="muted sa-cuenta">{{ filtradas().length }} de {{ empresas().length }} empresa{{ empresas().length === 1 ? '' : 's' }}</p>
      <div class="sa-lista">
        @for (e of filtradas(); track e.uuid) {
          <article [class]="'sa-empresa e-' + e.estado">
            <a class="sa-empresa-id" [routerLink]="['/superadmin/empresas', e.uuid]">
              <app-logo class="sa-logo grande" [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" />
              <span class="sa-empresa-nombre">
                <b>{{ e.nombreComercial }}</b>
                <small>{{ e.razonSocial }}</small>
              </span>
            </a>
            <span [class]="'st st-' + e.estado">{{ nombreEstado(e.estado) }}</span>
            <span class="sa-dato d-dir">
              <small>Dirección</small>
              <b class="num">/{{ e.identificador }}</b>
              @if (e.dominioPropio) { <span class="muted">{{ e.dominioPropio }}</span> }
            </span>
            <span class="sa-dato d-plan">
              <small>Plan</small>
              <b>{{ nombrePlan(e.plan) }}</b>
              <span class="muted num">{{ e.precioPlan | dinero }}/{{ e.cicloFacturacion === 'ANUAL' ? 'año' : 'mes' }}</span>
            </span>
            <span class="sa-dato d-fecha">
              <small>Creada</small>
              <span class="muted">{{ e.creadoEn | hora }}</span>
            </span>
            <span class="sa-acciones">
              @if (e.estado === 'activa') {
                <a class="mt-icono" [href]="'/' + e.identificador" target="_blank" rel="noopener" title="Abrir la tienda" aria-label="Abrir la tienda de {{ e.nombreComercial }}"><app-icono nombre="tienda" /></a>
                <a class="mt-icono" [href]="'/' + e.identificador + '/admin'" target="_blank" rel="noopener" title="Abrir el portal" aria-label="Abrir el portal de {{ e.nombreComercial }}"><app-icono nombre="externo" /></a>
              }
              <a class="btn" [routerLink]="['/superadmin/empresas', e.uuid]">Administrar</a>
            </span>
          </article>
        } @empty {
          <div class="empty">
            <b>Ninguna empresa coincide</b>
            <p class="muted">Prueba con otra búsqueda o quita los filtros.</p>
            <div><button class="btn" type="button" (click)="limpiar()">Quitar filtros</button></div>
          </div>
        }
      </div>
    }
  `,
})
export class EmpresasPage {
  private api = inject(PlataformaApi);

  /** Llega desde el Panel: ?estado=preparando */
  readonly estadoInicial = input<string | undefined>(undefined, { alias: 'estado' });

  protected readonly filtros = FILTROS;
  protected empresas = signal<EmpresaResumen[]>([]);
  protected planes = signal<Plan[]>([]);
  protected cargado = signal(false);
  protected error = signal('');
  protected busqueda = signal('');
  protected filtro = signal<FiltroEstado>('todas');
  protected plan = signal('');
  protected orden = signal<Orden>('recientes');
  protected vivo: { enVivo: () => boolean };

  protected conteo = computed(() => {
    const c: Record<FiltroEstado, number> = { todas: 0, activa: 0, preparando: 0, suspendida: 0, error_aprovisionamiento: 0 };
    for (const e of this.empresas()) { c.todas++; c[grupo(e.estado)]++; }
    return c;
  });

  protected filtradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const f = this.filtro();
    const plan = this.plan();
    const lista = this.empresas().filter((e) =>
      (f === 'todas' || grupo(e.estado) === f) && (!plan || e.plan === plan) &&
      (!q || [e.nombreComercial, e.identificador, e.razonSocial, e.dominioPropio ?? ''].some((t) => t.toLowerCase().includes(q))));
    const o = this.orden();
    return lista.sort((a, b) => o === 'nombre' ? a.nombreComercial.localeCompare(b.nombreComercial, 'es')
      : o === 'precio' ? b.precioPlan - a.precioPlan : b.creadoEn.localeCompare(a.creadoEn));
  });

  protected nombrePlan(codigo: string | null): string {
    return this.planes().find((p) => p.codigo === codigo)?.nombre ?? codigo ?? 'Sin plan';
  }

  constructor() {
    this.api.planes().subscribe((l) => this.planes.set(l));
    this.cargar();
    effect(() => {
      const e = this.estadoInicial();
      untracked(() => { if (e && FILTROS.some((f) => f.k === e)) this.filtro.set(e as FiltroEstado); });
    });
    // En vivo: la lista cambia sola cuando se crea una empresa, avanza su preparación o cambia su estado.
    this.vivo = enVivoPlataforma(() => this.cargar());
    // Respaldo lento por si la conexión en vivo no está disponible.
    const t = setInterval(() => {
      if (this.empresas().some((e) => grupo(e.estado) === 'preparando')) this.cargar();
    }, 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  private cargar(): void {
    this.api.empresas().subscribe({
      next: (l) => { this.empresas.set(l); this.cargado.set(true); this.error.set(''); },
      error: (e) => { this.error.set(mensajeError(e)); this.cargado.set(true); },
    });
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.filtro.set('todas');
    this.plan.set('');
  }

  protected nombreEstado(e: EstadoEmpresa): string {
    return NOMBRE_ESTADO_EMPRESA[e] ?? e;
  }
}

function grupo(e: EstadoEmpresa): Exclude<FiltroEstado, 'todas'> {
  return e === 'pendiente_aprovisionamiento' || e === 'aprovisionando' ? 'preparando' : e;
}
