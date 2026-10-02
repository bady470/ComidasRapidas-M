import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Icono } from '../compartido/icono';
import { ModoLleno } from './modo-lleno';
import { GrupoMenu, Shell } from '../compartido/shell';
import { AdminApi } from '../core/api';
import { AvisosPortal } from '../core/avisos-portal';
import { ImpresionCocina } from '../core/impresion-cocina';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { HoraPipe } from '../core/formato';
import { MODULOS, Notificacion } from '../core/modelos';
import { SesionAdmin } from '../core/sesion';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, Shell, Icono, HoraPipe, ModoLleno],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-shell [marca]="tienda()?.nombre ?? ''" subtitulo="Portal de pedidos" [logoUrl]="tienda()?.logoUrl" [grupos]="menu()"
               [usuario]="sesion.actual()?.nombre ?? ''" rol="Administrador" [inicio]="emp.url('/admin')" (salir)="salir()">
      <div acciones class="mt-botones">
        <app-modo-lleno />
        <span class="en-vivo" [class.off]="!avisos.enVivo()" [title]="avisos.enVivo() ? 'Conectado: los cambios llegan al instante' : 'Reconectando…'">
          {{ avisos.enVivo() ? 'En vivo' : 'Reconectando' }}</span>
        <button class="mt-icono campana" type="button" (click)="alternarAvisos()" [attr.aria-expanded]="avisosAbiertos()"
                [attr.aria-label]="'Avisos' + (noLeidas() ? ', ' + noLeidas() + ' sin leer' : '')" title="Avisos">
          <app-icono nombre="campana" />
          @if (noLeidas()) { <span class="pill num">{{ noLeidas() }}</span> }
        </button>
        <a class="btn" [href]="emp.url()" target="_blank" rel="noopener"><app-icono nombre="externo" /> Ver tienda</a>
        @if (avisosAbiertos()) {
          <div class="panel avisos-panel" role="dialog" aria-label="Avisos">
            <div class="row" style="justify-content:space-between">
              <h3>Avisos</h3>
              <button class="linkbtn" type="button" (click)="avisosAbiertos.set(false)">Cerrar</button>
            </div>
            @if (avisos.permiso() === 'default') {
              <div class="alerta aviso">
                Activa las notificaciones para enterarte de pedidos y pagos aunque tengas otra pestaña abierta.
                <div style="margin-top:6px"><button class="btn main" type="button" (click)="avisos.activarNotificaciones()">Activar notificaciones</button></div>
              </div>
            }
            @for (n of lista(); track n.id) {
              <button class="aviso-item" type="button" [class.nueva]="!n.leida" (click)="abrir(n)">
                <b>{{ n.titulo }}</b>
                <span class="muted">{{ n.mensaje }}</span>
                <span class="muted">{{ n.creado | hora }}</span>
              </button>
            } @empty {
              <p class="muted">Todavía no hay avisos. Aquí te contamos cuando llegue un pedido o un cliente adjunte su comprobante de pago.</p>
            }
          </div>
        }
      </div>
      <router-outlet />
    </app-shell>
    `,
})
export class AdminLayout implements OnInit {
  protected sesion = inject(SesionAdmin);
  protected estado = inject(EstadoTienda);
  protected emp = inject(EmpresaActual);
  protected avisos = inject(AvisosPortal);
  /** Comandas automáticas: escucha los pedidos en cualquier página del portal. */
  private impresion = inject(ImpresionCocina);
  protected readonly M = MODULOS;
  private api = inject(AdminApi);
  private router = inject(Router);
  protected tienda = computed(() => this.estado.catalogo()?.tienda ?? null);

  protected menu = computed<GrupoMenu[]>(() => [
    { titulo: 'Operación', items: [
      { ruta: 'pedidos', texto: 'Pedidos', icono: 'pedidos', insignia: this.porPagar() ? `${this.porPagar()} por pagar` : null },
      ...(this.estado.tieneModulo(MODULOS.reportes) ? [
        { ruta: 'estadisticas', texto: 'Estadísticas', icono: 'estadisticas' },
        { ruta: 'ventas', texto: 'Ventas del día', icono: 'ventas' },
      ] : []),
      ...(this.estado.tieneModulo(MODULOS.caja) ? [{ ruta: 'caja', texto: 'Cierre de caja', icono: 'caja' }] : []),
      ...(this.estado.tieneModulo(MODULOS.cocina) ? [{ ruta: 'cocina', texto: 'Cocina', icono: 'cocina' }] : []),
      { ruta: 'domiciliarios', texto: 'Domiciliarios', icono: 'domiciliarios' },
      ...(this.estado.tieneModulo(MODULOS.clientes) ? [{ ruta: 'clientes', texto: 'Clientes', icono: 'clientes' }] : []),
    ] },
    { titulo: 'Catálogo', items: [
      { ruta: 'productos', texto: 'Productos', icono: 'productos' },
      { ruta: 'categorias', texto: 'Categorías', icono: 'categorias' },
      ...(this.estado.tieneModulo(MODULOS.promociones) ? [{ ruta: 'promociones', texto: 'Promociones', icono: 'promociones' }] : []),
    ] },
    { titulo: 'Configuración', items: [
      { ruta: 'tienda', texto: 'Mi tienda', icono: 'tienda' },
      ...(this.estado.tieneModulo(MODULOS.mapas) ? [{ ruta: 'mapa', texto: 'Domicilios y mapa', icono: 'mapa' }] : []),
      ...(this.estado.tieneModulo(MODULOS.pagosEnLinea) ? [{ ruta: 'pagos-en-linea', texto: 'Pagos en línea', icono: 'pagos' }] : []),
    ] },
  ]);

  protected avisosAbiertos = signal(false);
  protected lista = computed(() => this.avisos.datos()?.lista ?? []);
  protected noLeidas = computed(() => this.avisos.datos()?.noLeidas ?? 0);
  protected porPagar = computed(() => this.avisos.datos()?.porPagar ?? 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.avisos.detener());
    // Si cambia el catálogo o la marca (otro administrador o el superadmin), el portal se actualiza solo.
    effect(() => { if (this.avisos.cambioCatalogo()) untracked(() => this.estado.cargar()); });
  }

  ngOnInit(): void {
    this.estado.asegurar();
    this.avisos.iniciar(this.emp.slug());
    this.impresion.iniciar(this.emp.slug());
  }

  protected alternarAvisos(): void {
    const abrir = !this.avisosAbiertos();
    this.avisosAbiertos.set(abrir);
    if (abrir) this.avisos.marcarLeidos();
  }

  /** Lleva al pedido del aviso: los pagos se buscan entre todos los pedidos por pagar (de cualquier día). */
  protected abrir(n: Notificacion): void {
    this.avisosAbiertos.set(false);
    this.router.navigate([this.emp.url('/admin/pedidos')], {
      queryParams: { q: n.codigo || null, filtro: n.tipo === 'PAGO_REPORTADO' || n.tipo === 'PAGO_REVERSADO' ? 'POR_PAGAR' : null },
    });
  }

  protected salir(): void {
    this.api.logout().subscribe({ complete: () => this.terminar(), error: () => this.terminar() });
  }

  private terminar(): void {
    this.avisos.detener();
    this.sesion.cerrar();
    this.router.navigateByUrl(this.emp.url('/admin/entrar'));
  }
}
