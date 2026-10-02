import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EstadoTienda } from '../core/estado-tienda';
import { SedeElegida } from '../core/sede';
import { MODULOS } from '../core/modelos';

/**
 * Filtro de sede en la barra del portal (empresas con varias sedes). Pedidos, cocina, estadísticas, ventas y caja
 * muestran la sede escogida; «Todas las sedes» suma todo. «Estamos llenos» y la caja aplican a la sede escogida.
 */
@Component({
  selector: 'app-filtro-sede',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <select class="filtro-sede" aria-label="Sede" [value]="valor()" (change)="cambiar($any($event.target).value)">
        <option value="">Todas las sedes</option>
        @for (s of sedes(); track s.id) { <option [value]="s.id">{{ s.nombre }}</option> }
      </select>
    }
  `,
  styles: `.filtro-sede { width: auto; max-width: 200px; border-radius: 999px; padding: 7px 12px; font-weight: 600; }`,
})
export class FiltroSede {
  private estado = inject(EstadoTienda);
  private sede = inject(SedeElegida);

  protected sedes = computed(() => this.estado.catalogo()?.tienda.sedes ?? []);
  protected visible = computed(() => this.estado.tieneModulo(MODULOS.sedes) && this.sedes().length > 1);
  protected valor = computed(() => { this.sede.version(); return String(this.sede.portal() ?? ''); });

  /** Al cambiar de sede se recarga la página: todos los datos del portal pasan a ser de esa sede. */
  protected cambiar(v: string): void {
    this.sede.fijarPortal(v ? Number(v) : null);
    location.reload();
  }
}
