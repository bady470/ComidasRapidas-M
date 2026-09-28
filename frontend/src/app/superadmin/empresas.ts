import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Logo } from '../compartido/logo';
import { PlataformaApi, mensajeError } from '../core/api';
import { HoraPipe } from '../core/formato';
import { EmpresaResumen, EstadoEmpresa, NOMBRE_ESTADO_EMPRESA, ResumenPlataforma } from '../core/modelos';

/** Todas las empresas de la plataforma con su estado. */
@Component({
  selector: 'app-empresas',
  imports: [FormsModule, RouterLink, Logo, HoraPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resumen(); as r) {
      <div class="kpis">
        <div class="kpi"><span class="muted">Empresas</span><div class="v">{{ r.total }}</div></div>
        <div class="kpi"><span class="muted">Activas</span><div class="v ok">{{ r.activas }}</div></div>
        <div class="kpi"><span class="muted">Preparando</span><div class="v">{{ r.enPreparacion }}</div></div>
        <div class="kpi"><span class="muted">Suspendidas</span><div class="v">{{ r.suspendidas }}</div></div>
        <div class="kpi"><span class="muted">Con error</span><div class="v">{{ r.conError }}</div></div>
      </div>
    }

    <div class="toolbar">
      <input type="search" placeholder="Buscar por nombre, identificador, razón social o dominio" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)">
      <a class="btn main" routerLink="/superadmin/empresas/nueva">+ Nueva empresa</a>
    </div>

    @if (error()) { <div class="alerta mala">{{ error() }}</div> }

    @if (cargado() && !empresas().length) {
      <div class="panel" style="text-align:center;padding:40px 16px">
        <h3>Todavía no hay empresas</h3>
        <p class="muted">Crea la primera: se prepara su base de datos, su tienda y su portal de pedidos.</p>
        <div><a class="btn main" routerLink="/superadmin/empresas/nueva">Crear la primera empresa</a></div>
      </div>
    } @else if (empresas().length) {
      <div class="panel tablewrap" style="padding:0">
        <table>
          <thead><tr><th>Empresa</th><th>Estado</th><th>Dirección</th><th>Módulos</th><th>Creada</th><th></th></tr></thead>
          <tbody>
            @for (e of filtradas(); track e.uuid) {
              <tr>
                <td>
                  <a class="empresa-fila" [routerLink]="['/superadmin/empresas', e.uuid]" style="text-decoration:none;color:inherit">
                    <app-logo [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" style="width:34px;height:34px" />
                    <span class="stack" style="gap:0"><b>{{ e.nombreComercial }}</b><span class="muted" style="font-size:13px">{{ e.razonSocial }}</span></span>
                  </a>
                </td>
                <td><span [class]="'st st-' + e.estado">{{ nombreEstado(e.estado) }}</span></td>
                <td style="font-size:14px">
                  <div class="num">/{{ e.identificador }}</div>
                  @if (e.dominioPropio) { <div class="muted">{{ e.dominioPropio }}</div> }
                </td>
                <td class="muted" style="font-size:13px">{{ e.modulos.length }}</td>
                <td class="muted" style="font-size:13px">{{ e.creadoEn | hora }}</td>
                <td class="r" style="white-space:nowrap">
                  @if (e.estado === 'activa') {
                    <a class="btn" [href]="'/' + e.identificador" target="_blank" rel="noopener">Tienda</a>
                    <a class="btn" [href]="'/' + e.identificador + '/admin'" target="_blank" rel="noopener">Portal</a>
                  }
                  <a class="btn" [routerLink]="['/superadmin/empresas', e.uuid]">Ver</a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted">Ninguna empresa coincide con la búsqueda.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class EmpresasPage {
  private api = inject(PlataformaApi);

  protected empresas = signal<EmpresaResumen[]>([]);
  protected resumen = signal<ResumenPlataforma | null>(null);
  protected cargado = signal(false);
  protected error = signal('');
  protected busqueda = signal('');

  protected filtradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    if (!q) return this.empresas();
    return this.empresas().filter((e) =>
      [e.nombreComercial, e.identificador, e.razonSocial, e.dominioPropio ?? ''].some((t) => t.toLowerCase().includes(q)));
  });

  constructor() {
    this.cargar();
    // Mientras haya empresas preparándose, se refresca solo.
    const t = setInterval(() => {
      if (this.empresas().some((e) => e.estado === 'pendiente_aprovisionamiento' || e.estado === 'aprovisionando')) this.cargar();
    }, 4000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  private cargar(): void {
    this.api.empresas().subscribe({
      next: (l) => { this.empresas.set(l); this.cargado.set(true); this.error.set(''); },
      error: (e) => this.error.set(mensajeError(e)),
    });
    this.api.resumen().subscribe({ next: (r) => this.resumen.set(r), error: () => { /* el listado ya muestra el error */ } });
  }

  protected nombreEstado(e: EstadoEmpresa): string {
    return NOMBRE_ESTADO_EMPRESA[e] ?? e;
  }
}
