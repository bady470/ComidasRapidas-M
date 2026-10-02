import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EstadoTienda } from '../core/estado-tienda';
import { soloHora } from '../core/formato';
import { AccionSaturacion } from '../core/modelos';

/**
 * Botón «Estamos llenos» de la barra del portal. En hora pico, con dos toques: subir el tiempo de entrega, pausar
 * los domicilios o dejar de recibir pedidos por un rato. Todo vuelve solo a la normalidad cuando se cumple el tiempo.
 */
@Component({
  selector: 'app-modo-lleno',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="btn" type="button" [class.lleno-activo]="activo()" (click)="abierto.set(!abierto())" [attr.aria-expanded]="abierto()">
      🔥 {{ activo() ? resumen() : 'Estamos llenos' }}
    </button>
    @if (abierto()) {
      <div class="panel lleno-panel" role="dialog" aria-label="Modo estamos llenos">
        <div class="row" style="justify-content:space-between">
          <h3>¿Mucha demanda?</h3>
          <button class="linkbtn" type="button" (click)="abierto.set(false)">Cerrar</button>
        </div>
        <p class="muted" style="font-size:13px">Tus clientes lo ven al instante en la tienda y todo vuelve a la normalidad solo.</p>

        @if (s(); as sat) {
          @if (activo()) {
            <div class="alerta aviso">
              @if (sat.minutosExtra) { <div>⏱ Entregas con <b>+{{ sat.minutosExtra }} min</b> hasta las {{ hora(sat.demoraHasta) }} · <button class="linkbtn" type="button" (click)="hacer('QUITAR_DEMORA')">Quitar</button></div> }
              @if (sat.domiciliosPausadosHasta) { <div>🛵 Domicilios pausados hasta las {{ hora(sat.domiciliosPausadosHasta) }} · <button class="linkbtn" type="button" (click)="hacer('REANUDAR_DOMICILIOS')">Reanudar</button></div> }
              @if (sat.pedidosPausadosHasta) { <div>⛔ Sin recibir pedidos hasta las {{ hora(sat.pedidosPausadosHasta) }} · <button class="linkbtn" type="button" (click)="hacer('REANUDAR_PEDIDOS')">Reanudar</button></div> }
            </div>
          }
        }

        <div class="field"><label for="llDur">¿Por cuánto tiempo?</label>
          <select id="llDur" [(ngModel)]="duracion">
            <option [ngValue]="15">15 minutos</option><option [ngValue]="30">30 minutos</option><option [ngValue]="60">1 hora</option>
            <option [ngValue]="90">1 hora y media</option><option [ngValue]="120">2 horas</option>
          </select></div>

        <div class="field"><span class="flabel">Subir el tiempo de entrega</span>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            @for (m of [15, 30, 45, 60]; track m) {
              <button class="btn" type="button" [disabled]="ocupado()" (click)="hacer('DEMORA', m)">+{{ m }} min</button>
            }
          </div></div>
        <div class="field"><span class="flabel">Pausar</span>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            @if (tieneDomicilio()) { <button class="btn" type="button" [disabled]="ocupado()" (click)="hacer('PAUSAR_DOMICILIOS')">🛵 Solo domicilios</button> }
            <button class="btn bad" type="button" [disabled]="ocupado()" (click)="hacer('PAUSAR_PEDIDOS')">⛔ Todos los pedidos</button>
          </div></div>
        @if (error()) { <p class="err">{{ error() }}</p> }
        @if (activo()) { <button class="btn okb" type="button" [disabled]="ocupado()" (click)="hacer('NORMAL')">Volver a la normalidad</button> }
      </div>
    }
  `,
  styles: `
    :host { position: relative; }
    .lleno-activo { background: var(--warn-soft); color: var(--warn); border-color: color-mix(in srgb, var(--warn) 35%, transparent); }
    .lleno-panel { position: absolute; right: 0; top: calc(100% + 8px); width: min(340px, 90vw); z-index: 30; box-shadow: 0 16px 40px rgba(0,0,0,.18); }
  `,
})
export class ModoLleno {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  private estado = inject(EstadoTienda);

  protected abierto = signal(false);
  protected ocupado = signal(false);
  protected error = signal('');
  protected duracion = 60;

  protected s = computed(() => this.estado.catalogo()?.tienda.saturacion ?? null);
  protected tieneDomicilio = computed(() => {
    const t = this.estado.catalogo()?.tienda;
    return !!t && (t.domicilioActivo || !!t.saturacion.domiciliosPausadosHasta);
  });
  protected activo = computed(() => {
    const s = this.s();
    return !!s && (s.minutosExtra > 0 || !!s.domiciliosPausadosHasta || !!s.pedidosPausadosHasta);
  });
  protected resumen = computed(() => {
    const s = this.s();
    if (!s) return '';
    if (s.pedidosPausadosHasta) return 'Pedidos pausados';
    if (s.domiciliosPausadosHasta) return 'Domicilios pausados';
    return `+${s.minutosExtra} min`;
  });

  protected hora(iso: string | null): string { return iso ? soloHora(iso) : ''; }

  protected hacer(accion: AccionSaturacion, minutos = 0): void {
    this.ocupado.set(true);
    this.error.set('');
    this.api.saturacion(accion, minutos, this.duracion).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.estado.cargar();
        this.avisos.mostrar(accion === 'NORMAL' ? 'Todo volvió a la normalidad' : 'Listo: tus clientes ya lo ven');
      },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
