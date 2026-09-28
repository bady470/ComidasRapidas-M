import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EstadoTienda } from '../core/estado-tienda';
import { CategoriaAdmin } from '../core/modelos';

/** Secciones del menú: hamburguesas, bebidas, postres… */
@Component({
  selector: 'app-categorias',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="editor" (ngSubmit)="crear()" style="max-width:640px">
      <h3>Nueva categoría</h3>
      <div class="row">
        <input name="nueva" [(ngModel)]="nueva" placeholder="Ej: Hamburguesas, Bebidas, Postres" aria-label="Nombre de la categoría"
               style="flex:1;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:10px 12px">
        <button class="btn main" type="submit">Agregar</button>
      </div>
      <span class="hint">En la tienda, los productos se muestran agrupados por categoría y en este orden.</span>
      @if (error()) { <p class="err">{{ error() }}</p> }
    </form>

    <div class="plist" style="max-width:640px">
      @for (c of categorias(); track c.id; let i = $index; let ultimo = $last) {
        <div class="pitem" style="grid-template-columns:1fr auto">
          <div class="stack" style="gap:4px">
            @if (editando() === c.id) {
              <input [(ngModel)]="nombreEditado" [name]="'n' + c.id" aria-label="Nombre"
                     style="border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:8px 10px">
            } @else {
              <b>{{ c.nombre }}</b>
            }
            <span class="meta">{{ c.productos }} {{ c.productos === 1 ? 'producto' : 'productos' }}{{ c.activa ? '' : ' · oculta en la tienda' }}</span>
          </div>
          <div class="acts">
            <button class="btn" (click)="mover(c, -1)" [disabled]="i === 0" aria-label="Subir">↑</button>
            <button class="btn" (click)="mover(c, 1)" [disabled]="ultimo" aria-label="Bajar">↓</button>
            @if (editando() === c.id) {
              <button class="btn main" (click)="renombrar(c)">Guardar</button>
            } @else {
              <button class="btn" (click)="editando.set(c.id); nombreEditado = c.nombre">Renombrar</button>
            }
            <button class="btn" (click)="guardar(c, { activa: !c.activa })">{{ c.activa ? 'Ocultar' : 'Mostrar' }}</button>
            @if (confirmar() === c.id) {
              <button class="btn sure" (click)="eliminar(c)">Sí, eliminar</button>
              <button class="btn" (click)="confirmar.set(null)">No</button>
            } @else {
              <button class="btn bad" (click)="confirmar.set(c.id)">Eliminar</button>
            }
          </div>
        </div>
      } @empty {
        <div class="empty">Aún no hay categorías. Sin categorías, todos los productos se muestran juntos.</div>
      }
    </div>
    @if (confirmar()) { <p class="muted" style="max-width:640px">Al eliminar una categoría, sus productos no se borran: quedan en «Otros».</p> }
  `,
})
export class CategoriasPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  private estado = inject(EstadoTienda);

  protected categorias = signal<CategoriaAdmin[]>([]);
  protected editando = signal<number | null>(null);
  protected confirmar = signal<number | null>(null);
  protected error = signal('');
  protected nueva = '';
  protected nombreEditado = '';

  constructor() {
    this.api.categorias().subscribe({ next: (l) => this.categorias.set(l), error: (e) => this.error.set(mensajeError(e)) });
  }

  private listo(l: CategoriaAdmin[], aviso?: string): void {
    this.categorias.set(l);
    this.error.set('');
    this.estado.cargar();
    if (aviso) this.avisos.mostrar(aviso);
  }

  protected crear(): void {
    const nombre = this.nueva.trim();
    if (!nombre) { this.error.set('Escribe el nombre de la categoría.'); return; }
    const orden = Math.max(0, ...this.categorias().map((c) => c.orden)) + 1;
    this.api.guardarCategoria(null, { nombre, activa: true, orden }).subscribe({
      next: (l) => { this.nueva = ''; this.listo(l, 'Categoría agregada'); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  protected guardar(c: CategoriaAdmin, cambio: Partial<CategoriaAdmin>): void {
    const d = { ...c, ...cambio };
    this.api.guardarCategoria(c.id, { nombre: d.nombre, activa: d.activa, orden: d.orden }).subscribe({
      next: (l) => this.listo(l),
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  protected renombrar(c: CategoriaAdmin): void {
    if (!this.nombreEditado.trim()) return;
    this.editando.set(null);
    this.guardar(c, { nombre: this.nombreEditado.trim() });
  }

  /** Cambia de lugar con la vecina y renumera todas para que el orden quede limpio. */
  protected mover(c: CategoriaAdmin, delta: number): void {
    const lista = [...this.categorias()];
    const i = lista.findIndex((x) => x.id === c.id);
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    lista.forEach((x, k) => {
      if (x.orden !== k + 1) this.api.guardarCategoria(x.id, { nombre: x.nombre, activa: x.activa, orden: k + 1 })
        .subscribe({ next: (l) => this.listo(l) });
    });
  }

  protected eliminar(c: CategoriaAdmin): void {
    this.confirmar.set(null);
    this.api.eliminarCategoria(c.id).subscribe({
      next: (l) => this.listo(l, 'Categoría eliminada'),
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }
}
