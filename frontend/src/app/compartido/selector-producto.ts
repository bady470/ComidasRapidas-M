import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DineroPipe } from '../core/formato';
import { Grupo, Producto } from '../core/modelos';
import { Foto } from './foto';

export interface Seleccion { productoId: number; opcionIds: number[]; cantidad: number; }

/**
 * Hoja para escoger las opciones de un producto (tamaño, adiciones, salsas…) y la cantidad.
 * La usan el catálogo del cliente y el formulario de pedido manual del panel.
 */
@Component({
  selector: 'app-selector-producto',
  imports: [Foto, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hoja-fondo" (click)="cerrar.emit()">
      <div class="hoja" role="dialog" aria-modal="true" [attr.aria-label]="producto().nombre" (click)="$event.stopPropagation()" style="position:relative">
        <div class="cuerpo">
          @if (conFoto()) {
            <div class="foto-hoja" style="margin:-16px -16px 0"><app-foto [imagenId]="producto().imagenId" [nombre]="producto().nombre" /></div>
          }
          <div class="stack" style="gap:6px">
            <h2 style="font-size:24px">{{ producto().nombre }}</h2>
            @if (producto().descripcion) { <p class="muted" style="font-size:15px">{{ producto().descripcion }}</p> }
            <span class="price num" style="font-size:20px">{{ producto().precioHoy | dinero }}</span>
          </div>

          @for (g of producto().grupos; track g.id) {
            <fieldset class="grupo" style="border:0;padding:0;margin:0">
              <legend class="grupo-h" style="width:100%">
                <b>{{ g.nombre }}</b>
                <span class="chip" [class.hot]="g.minimo > 0">{{ regla(g) }}</span>
              </legend>
              <div class="opts">
                @for (o of g.opciones; track o.id) {
                  <label class="opt" [class.agotada]="!o.disponible">
                    <input [type]="g.maximo === 1 ? 'radio' : 'checkbox'" [name]="'g' + g.id"
                           [checked]="escogida(o.id)" [disabled]="!o.disponible || (!escogida(o.id) && lleno(g) && g.maximo > 1)"
                           (change)="alternar(g, o.id)">
                    <span class="nom">{{ o.nombre }}@if (!o.disponible) { <span class="muted"> · agotado</span> }</span>
                    @if (o.precioExtra) { <span class="precio-extra num">+{{ o.precioExtra | dinero }}</span> }
                  </label>
                }
              </div>
            </fieldset>
          }
        </div>
        <div class="pie">
          <div class="stepper">
            <button type="button" (click)="cantidad.set(cantidad() > 1 ? cantidad() - 1 : 1)" aria-label="Quitar uno">−</button>
            <span class="num">{{ cantidad() }}</span>
            <button type="button" (click)="cantidad.set(cantidad() < 99 ? cantidad() + 1 : 99)" aria-label="Agregar uno">+</button>
          </div>
          <button class="primary" type="button" [disabled]="!completo()" (click)="confirmar()">
            {{ completo() ? textoBoton() + ' · ' : '' }}<span class="num">{{ completo() ? (total() | dinero) : faltante() }}</span>
          </button>
        </div>
        <button class="cerrar" type="button" (click)="cerrar.emit()" aria-label="Cerrar">✕</button>
      </div>
    </div>
  `,
})
export class SelectorProducto {
  readonly producto = input.required<Producto>();
  readonly textoBoton = input('Agregar');
  readonly elegido = output<Seleccion>();
  readonly cerrar = output<void>();

  protected cantidad = signal(1);
  private seleccion = signal<Set<number>>(new Set());

  protected conFoto = computed(() => this.producto().imagenId != null);

  protected escogida(id: number): boolean {
    return this.seleccion().has(id);
  }

  private delGrupo(g: Grupo): number {
    return g.opciones.filter((o) => this.seleccion().has(o.id)).length;
  }

  protected lleno(g: Grupo): boolean {
    return this.delGrupo(g) >= g.maximo;
  }

  protected regla(g: Grupo): string {
    if (g.minimo === 1 && g.maximo === 1) return 'Escoge 1';
    if (g.minimo > 0) return g.minimo === g.maximo ? `Escoge ${g.minimo}` : `Escoge de ${g.minimo} a ${g.maximo}`;
    return g.maximo === 1 ? 'Opcional' : `Opcional · hasta ${g.maximo}`;
  }

  protected alternar(g: Grupo, id: number): void {
    const s = new Set(this.seleccion());
    if (g.maximo === 1) {
      g.opciones.forEach((o) => s.delete(o.id));
      s.add(id);
    } else if (s.has(id)) {
      s.delete(id);
    } else if (this.delGrupo(g) < g.maximo) {
      s.add(id);
    }
    this.seleccion.set(s);
  }

  protected faltante = computed(() => {
    const g = this.producto().grupos.find((x) => this.delGrupo(x) < x.minimo);
    return g ? `Escoge ${g.nombre.toLowerCase()}` : '';
  });

  protected completo = computed(() => !this.faltante());

  protected total = computed(() => {
    const extras = this.producto().grupos.flatMap((g) => g.opciones)
      .filter((o) => this.seleccion().has(o.id)).reduce((a, o) => a + o.precioExtra, 0);
    return (this.producto().precioHoy + extras) * this.cantidad();
  });

  protected confirmar(): void {
    if (!this.completo()) return;
    this.elegido.emit({ productoId: this.producto().id, opcionIds: [...this.seleccion()], cantidad: this.cantidad() });
  }
}
