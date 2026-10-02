import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { EstadoTienda } from '../core/estado-tienda';
import { SedeElegida } from '../core/sede';
import { SedePublica } from '../core/modelos';
import { kmEntre, miUbicacion } from './mapa';
import { ModalCentro } from './modal-centro';
import { Icono } from './icono';

/**
 * «¿En qué sede pides?» para empresas con varias sedes: botón en la barra de la tienda con la sede actual y un modal
 * en el centro de la pantalla para escogerla (o tomar la más cercana con la ubicación). La primera vez se abre solo.
 */
@Component({
  selector: 'app-selector-sede',
  imports: [ModalCentro, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sedes().length > 1) {
      <button class="btn sede-boton" type="button" (click)="abierto.set(true)" aria-haspopup="dialog">
        <app-icono nombre="pin" [tam]="16" /> {{ actual()?.nombre ?? 'Escoge sede' }}
      </button>
      @if (abierto()) {
        <app-modal-centro icono="pin" etiqueta="Escoge la sede" [ancha]="true" (cerrar)="cerrar()">
          <h2>¿En qué sede pides?</h2>
          <p>El menú, los precios, el horario y el domicilio pueden cambiar según la sede.</p>
          <div class="mc-acciones">
            <button class="btn" type="button" [disabled]="ubicando()" (click)="cercana()"><app-icono nombre="brujula" [tam]="16" /> {{ ubicando() ? 'Buscando dónde estás…' : 'Escoger la más cercana a mí' }}</button>
            @if (aviso()) { <span class="hint">{{ aviso() }}</span> }
          </div>
          <div class="mc-sedes">
            @for (s of sedes(); track s.id) {
              <button type="button" class="mc-sede" [class.activa]="s.id === actual()?.id" (click)="escoger(s)">
                <span class="mc-sede-pin" aria-hidden="true"><app-icono nombre="local" [tam]="20" /></span>
                <b>{{ s.nombre }}</b>
                <span class="st" [class.pay-RECIBIDO]="s.abierta" [class.pay-PENDIENTE]="!s.abierta">{{ s.abierta ? 'Abierta' : 'Cerrada' }}</span>
                <span class="muted">{{ s.direccion }}{{ s.ciudad ? ', ' + s.ciudad : '' }}{{ distancia(s) }}</span>
              </button>
            }
          </div>
        </app-modal-centro>
      }
    }
  `,
  styles: `.sede-boton { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }`,
})
export class SelectorSede {
  private estado = inject(EstadoTienda);
  private sede = inject(SedeElegida);

  protected abierto = signal(false);
  protected ubicando = signal(false);
  protected aviso = signal('');
  private yo = signal<{ lat: number; lng: number } | null>(null);

  protected sedes = computed(() => this.estado.catalogo()?.tienda.sedes ?? []);
  protected actual = computed(() => {
    const t = this.estado.catalogo()?.tienda;
    return t?.sedes.find((s) => s.id === t.sedeId) ?? null;
  });

  constructor() {
    // Apenas el cliente entra a una empresa con varias sedes, se le pregunta en cuál pide (la última queda marcada).
    effect(() => {
      if (this.sedes().length > 1 && !this.sede.escogidaEnVisita()) untracked(() => this.abierto.set(true));
    });
    // Otro componente (el aviso de cerrado) pide abrirlo.
    effect(() => {
      if (this.sede.abrirSelector()) untracked(() => this.abierto.set(true));
    });
  }

  protected escoger(s: SedePublica): void {
    this.sede.fijarTienda(s.id);
    this.abierto.set(false);
    this.estado.cargar();
  }

  /** Si cierra sin escoger, se queda con la que estaba (y no se le vuelve a preguntar en esta visita). */
  protected cerrar(): void {
    const a = this.actual();
    if (!this.sede.tiendaEscogida() && a) this.sede.fijarTienda(a.id);
    else this.sede.escogidaEnVisita.set(true);
    this.abierto.set(false);
  }

  protected distancia(s: SedePublica): string {
    const yo = this.yo();
    if (!yo || s.lat == null || s.lng == null) return '';
    return ' · a ' + kmEntre(yo, { lat: s.lat, lng: s.lng }).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' km';
  }

  /** Escoge la sede más cercana (de las que tienen ubicación). */
  protected async cercana(): Promise<void> {
    this.ubicando.set(true);
    this.aviso.set('');
    try {
      const yo = await miUbicacion();
      this.yo.set(yo);
      const conUbicacion = this.sedes().filter((s) => s.lat != null && s.lng != null);
      if (!conUbicacion.length) { this.aviso.set('Las sedes no tienen ubicación en el mapa: escoge una de la lista.'); return; }
      const mejor = conUbicacion.reduce((a, b) => kmEntre(yo, { lat: a.lat!, lng: a.lng! }) <= kmEntre(yo, { lat: b.lat!, lng: b.lng! }) ? a : b);
      this.escoger(mejor);
    } catch (e) {
      this.aviso.set((e as Error).message);
    } finally {
      this.ubicando.set(false);
    }
  }
}
