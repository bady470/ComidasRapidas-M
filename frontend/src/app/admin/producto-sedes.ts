import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe } from '../core/formato';
import { MenuSedes, ProductoAdmin, ProductoEnSede } from '../core/modelos';

/**
 * Un producto en cada sede: agotado ahí y, con el menú personalizado por sede, si esa sede lo vende y con qué precio
 * (vacío = el precio del producto).
 */
@Component({
  selector: 'app-producto-sedes',
  imports: [FormsModule, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hoja-fondo" (click)="cerrar.emit()">
      <div class="hoja panel" role="dialog" aria-modal="true" [attr.aria-label]="'Por sede: ' + producto().nombre" (click)="$event.stopPropagation()">
        <div class="row" style="justify-content:space-between">
          <h3>{{ producto().nombre }} · por sede</h3>
          <button class="linkbtn" type="button" (click)="cerrar.emit()">Cerrar</button>
        </div>
        <p class="muted" style="font-size:13px">
          @if (menu() === 'POR_SEDE') { Escoge en qué sedes se vende, su precio en cada una (vacío = {{ producto().precio | dinero }}) y si está agotado. }
          @else { El menú es el mismo en todas las sedes: aquí solo marcas en cuáles está agotado. Para precios por sede, cambia el menú en «Sedes». }
        </p>
        @for (s of lista(); track s.sedeId; let i = $index) {
          <div class="row" style="gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:8px">
            <b style="min-width:120px">{{ s.sede }}</b>
            @if (menu() === 'POR_SEDE') {
              <label class="check"><input type="checkbox" [name]="'of' + i" [ngModel]="s.ofrecido" (ngModelChange)="cambiar(i, { ofrecido: $event })"> Se vende aquí</label>
              <input type="number" min="1" step="500" [name]="'pr' + i" [ngModel]="s.precio" (ngModelChange)="cambiar(i, { precio: $event ? +$event : null })"
                     [placeholder]="'' + producto().precio" style="width:120px" [disabled]="!s.ofrecido" aria-label="Precio en esta sede">
            }
            <label class="check"><input type="checkbox" [name]="'ag' + i" [ngModel]="!s.disponible" (ngModelChange)="cambiar(i, { disponible: !$event })"> Agotado aquí</label>
          </div>
        }
        <div class="row">
          <button class="btn main" type="button" [disabled]="guardando() || !lista().length" (click)="guardar()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ProductoSedes {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);

  readonly producto = input.required<ProductoAdmin>();
  readonly cerrar = output<void>();

  protected lista = signal<ProductoEnSede[]>([]);
  protected menu = signal<MenuSedes>('COMPARTIDO');
  protected guardando = signal(false);

  constructor() {
    this.api.sedes().subscribe({ next: (p) => this.menu.set(p.menu), error: () => {} });
    effect(() => {
      const id = this.producto().id;
      untracked(() => this.api.productoEnSedes(id).subscribe({ next: (l) => this.lista.set(l), error: (e) => this.avisos.mostrar(mensajeError(e)) }));
    });
  }

  protected cambiar(i: number, p: Partial<ProductoEnSede>): void {
    this.lista.update((l) => l.map((s, j) => (j === i ? { ...s, ...p } : s)));
  }

  protected guardar(): void {
    this.guardando.set(true);
    this.api.guardarProductoEnSedes(this.producto().id, this.lista()).subscribe({
      next: (l) => { this.guardando.set(false); this.lista.set(l); this.avisos.mostrar('Guardado por sede'); this.cerrar.emit(); },
      error: (e) => { this.guardando.set(false); this.avisos.mostrar(mensajeError(e)); },
    });
  }
}
