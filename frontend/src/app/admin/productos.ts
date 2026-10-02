import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Foto } from '../compartido/foto';
import { SubirImagen } from './subir-imagen';
import { ProductoSedes } from './producto-sedes';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EstadoTienda } from '../core/estado-tienda';
import { DineroPipe, dinero } from '../core/formato';
import { CategoriaAdmin, GrupoAdmin, MODULOS, ProductoAdmin, ProductoForm } from '../core/modelos';

const PLANTILLAS: { nombre: string; grupo: () => GrupoAdmin }[] = [
  { nombre: 'Tamaño', grupo: () => ({ id: null, nombre: 'Tamaño', minimo: 1, maximo: 1, opciones: [
    { id: null, nombre: 'Personal', precioExtra: 0, disponible: true },
    { id: null, nombre: 'Grande', precioExtra: 4000, disponible: true }] }) },
  { nombre: 'Adiciones', grupo: () => ({ id: null, nombre: 'Adiciones', minimo: 0, maximo: 5, opciones: [
    { id: null, nombre: 'Extra queso', precioExtra: 2500, disponible: true },
    { id: null, nombre: 'Tocineta', precioExtra: 3000, disponible: true }] }) },
  { nombre: 'Quitar ingredientes', grupo: () => ({ id: null, nombre: 'Sin…', minimo: 0, maximo: 4, opciones: [
    { id: null, nombre: 'Sin cebolla', precioExtra: 0, disponible: true },
    { id: null, nombre: 'Sin salsas', precioExtra: 0, disponible: true }] }) },
  { nombre: 'Bebida', grupo: () => ({ id: null, nombre: 'Bebida', minimo: 1, maximo: 1, opciones: [
    { id: null, nombre: 'Gaseosa', precioExtra: 0, disponible: true },
    { id: null, nombre: 'Jugo natural', precioExtra: 1500, disponible: true }] }) },
];

@Component({
  selector: 'app-productos',
  imports: [FormsModule, Foto, DineroPipe, SubirImagen, ProductoSedes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <button class="btn main" (click)="nuevo()">+ Nuevo producto</button>
      <select aria-label="Filtrar por categoría" [ngModel]="filtroCat()" (ngModelChange)="filtroCat.set($event)">
        <option [ngValue]="undefined">Todas las categorías</option>
        @for (c of categorias(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
        <option [ngValue]="null">Sin categoría</option>
      </select>
      <span class="muted">El costo nunca se muestra a los clientes.</span>
    </div>

    @if (editando(); as e) {
      <form class="editor" (ngSubmit)="guardar()">
        <h3>{{ e.id ? 'Editar producto' : 'Nuevo producto' }}</h3>
        <app-subir-imagen [imagenId]="e.form.imagenId" (cambio)="imagen($event)" ayuda="Se ve mejor horizontal (4:3)." />
        <div class="row2">
          <div class="field"><label for="pNombre">Nombre</label><input id="pNombre" name="pNombre" [(ngModel)]="e.form.nombre"></div>
          <div class="field"><label for="pCat">Categoría</label>
            <select id="pCat" name="pCat" [(ngModel)]="e.form.categoriaId">
              <option [ngValue]="null">Sin categoría</option>
              @for (c of categorias(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
            </select></div>
        </div>
        <div class="field"><label for="pDesc">Descripción</label><textarea id="pDesc" name="pDesc" [(ngModel)]="e.form.descripcion" placeholder="Ingredientes, tamaño, lo que lo hace especial"></textarea></div>
        <div class="row2">
          <div class="field"><label for="pPrecio">Precio de venta</label>
            <input id="pPrecio" name="pPrecio" type="number" min="0" step="100" [(ngModel)]="e.form.precio"></div>
          <div class="field"><label for="pCosto">Costo por unidad <span class="hint">(solo para tus reportes)</span></label>
            <input id="pCosto" name="pCosto" type="number" min="0" step="10" [(ngModel)]="e.form.costo">
            <span class="hint">{{ margen(e.form) }}</span></div>
        </div>
        <div class="row2">
          <div class="field"><label for="pEtiq">Etiqueta <span class="hint">(opcional)</span></label>
            <input id="pEtiq" name="pEtiq" [(ngModel)]="e.form.etiqueta" placeholder="Ej: Nuevo, Más pedido, Picante"></div>
          <div class="field"><label for="pOrden">Orden dentro de su categoría</label>
            <input id="pOrden" name="pOrden" type="number" min="0" [(ngModel)]="e.form.orden"></div>
        </div>
        <label class="check"><input type="checkbox" name="pDisp" [(ngModel)]="e.form.disponible"> Disponible para pedir</label>

        @if (estado.tieneModulo(M.opciones)) {
        <span class="sec-titulo">Opciones del producto</span>
        <p class="muted">Tamaños, adiciones con precio, salsas o ingredientes para quitar. Déjalo vacío si el producto no tiene opciones.</p>
        @for (g of e.form.grupos; track $index; let gi = $index) {
          <div class="grupo-editor">
            <div class="row2">
              <div class="field"><label [for]="'gn' + gi">Nombre del grupo</label><input [id]="'gn' + gi" [name]="'gn' + gi" [(ngModel)]="g.nombre" placeholder="Ej: Tamaño"></div>
              <div class="row2">
                <div class="field"><label [for]="'gmin' + gi">Mínimo</label><input [id]="'gmin' + gi" [name]="'gmin' + gi" type="number" min="0" [(ngModel)]="g.minimo"></div>
                <div class="field"><label [for]="'gmax' + gi">Máximo</label><input [id]="'gmax' + gi" [name]="'gmax' + gi" type="number" min="1" [(ngModel)]="g.maximo"></div>
              </div>
            </div>
            <span class="hint">{{ reglaTexto(g) }}</span>
            @for (o of g.opciones; track $index; let oi = $index) {
              <div class="fila-opcion">
                <input type="text" [name]="'on' + gi + '-' + oi" [(ngModel)]="o.nombre" placeholder="Nombre de la opción" aria-label="Nombre de la opción">
                <input type="number" min="0" step="100" [name]="'op' + gi + '-' + oi" [(ngModel)]="o.precioExtra" placeholder="+ $" aria-label="Precio adicional">
                <label class="check"><input type="checkbox" [name]="'od' + gi + '-' + oi" [(ngModel)]="o.disponible"> Hay</label>
                <button class="btn bad" type="button" (click)="quitarOpcion(g, oi)" aria-label="Quitar opción">✕</button>
              </div>
            }
            <div class="row">
              <button class="btn" type="button" (click)="agregarOpcion(g)">+ Opción</button>
              <span class="spacer"></span>
              <button class="btn" type="button" (click)="moverGrupo(gi, -1)" [disabled]="gi === 0" aria-label="Subir grupo">↑</button>
              <button class="btn bad" type="button" (click)="quitarGrupo(gi)">Quitar grupo</button>
            </div>
          </div>
        }
        <div class="row">
          <button class="btn" type="button" (click)="agregarGrupo()">+ Grupo de opciones</button>
          <span class="muted">o usa una plantilla:</span>
          @for (t of plantillas; track t.nombre) { <button class="btn" type="button" (click)="agregarGrupo(t.grupo())">{{ t.nombre }}</button> }
        </div>
        }

        @if (errorForm()) { <p class="err">{{ errorForm() }}</p> }
        <div class="row"><button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar producto' }}</button>
          <button class="btn" type="button" (click)="editando.set(null)">Cancelar</button></div>
      </form>
    }

    <div class="panel tablewrap tabla-datos" style="padding:0">
      <table>
        <thead>
          <tr><th style="width:64px"></th><th>Producto</th><th>Categoría</th><th class="r">Precio</th><th class="r">Costo</th><th>Opciones</th><th>Estado</th><th class="r">Acciones</th></tr>
        </thead>
        <tbody>
          @for (p of visibles(); track p.id) {
            <tr [class.apagada]="!p.disponible">
              <td><div class="mini"><app-foto [imagenId]="p.imagenId" [nombre]="p.nombre" /></div></td>
              <td><b>{{ p.nombre }}</b>@if (p.etiqueta) { <span class="chip hot" style="margin-left:6px">{{ p.etiqueta }}</span> }</td>
              <td class="muted">{{ nombreCategoria(p.categoriaId) }}</td>
              <td class="r num"><b>{{ p.precio | dinero }}</b></td>
              <td class="r num"><span>{{ p.costo | dinero }}</span><div class="muted">{{ margen(p) }}</div></td>
              <td class="muted" style="max-width:220px">{{ p.grupos.length ? resumenGrupos(p) : '—' }}</td>
              <td><span class="st" [class.pay-RECIBIDO]="p.disponible" [class.pay-PENDIENTE]="!p.disponible">{{ p.disponible ? 'Disponible' : 'Agotado' }}</span></td>
              <td class="r">
                <div class="acciones-fila">
                  <button class="btn" (click)="editar(p)">Editar</button>
                  <button class="btn" (click)="disponible(p)">{{ p.disponible ? 'Agotar' : 'Activar' }}</button>
                  @if (estado.tieneModulo(M.sedes)) { <button class="btn" (click)="porSede.set(p)">Por sede</button> }
                  <button class="btn" (click)="duplicar(p)">Duplicar</button>
                  @if (confirmar() === p.id) {
                    <button class="btn sure" (click)="eliminar(p)">Confirmar</button>
                    <button class="btn" (click)="confirmar.set(null)">No</button>
                  } @else {
                    <button class="btn bad" (click)="confirmar.set(p.id)">Eliminar</button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="vacio">No hay productos aquí. Crea el primero con «Nuevo producto».</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (porSede(); as p) { <app-producto-sedes [producto]="p" (cerrar)="porSede.set(null)" /> }
  `,
})
export class ProductosPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  protected estado = inject(EstadoTienda);
  /** Producto abierto en el editor «Por sede». */
  protected porSede = signal<ProductoAdmin | null>(null);
  protected readonly M = MODULOS;

  protected plantillas = PLANTILLAS;
  protected productos = signal<ProductoAdmin[]>([]);
  protected categorias = signal<CategoriaAdmin[]>([]);
  protected filtroCat = signal<number | null | undefined>(undefined);
  protected editando = signal<{ id: number | null; form: ProductoForm } | null>(null);
  protected errorForm = signal('');
  protected guardando = signal(false);
  protected confirmar = signal<number | null>(null);

  protected visibles = computed(() => {
    const f = this.filtroCat();
    return f === undefined ? this.productos() : this.productos().filter((p) => p.categoriaId === f);
  });

  constructor() {
    this.cargar();
    this.api.categorias().subscribe((l) => this.categorias.set(l));
  }

  private cargar(): void {
    this.api.productos().subscribe({ next: (l) => this.productos.set(l), error: (e) => this.avisos.mostrar(mensajeError(e)) });
  }

  protected nombreCategoria(id: number | null): string {
    return this.categorias().find((c) => c.id === id)?.nombre ?? 'Sin categoría';
  }

  protected margen(p: { precio: number; costo: number }): string {
    const pr = Number(p.precio) || 0, c = Number(p.costo) || 0;
    if (!pr) return '';
    if (!c) return 'sin costo registrado';
    return `ganancia ${dinero(pr - c)} por unidad (${Math.round(((pr - c) / pr) * 100)} %)`;
  }

  protected resumenGrupos(p: ProductoAdmin): string {
    return p.grupos.map((g) => `${g.nombre} (${g.opciones.length})`).join(', ');
  }

  protected reglaTexto(g: GrupoAdmin): string {
    const min = Number(g.minimo) || 0, max = Number(g.maximo) || 1;
    if (min === 1 && max === 1) return 'El cliente debe escoger exactamente una opción.';
    if (min > 0) return `El cliente debe escoger entre ${min} y ${max} opciones.`;
    return max === 1 ? 'Opcional: puede escoger una o ninguna.' : `Opcional: puede escoger hasta ${max}.`;
  }

  protected nuevo(): void {
    this.errorForm.set('');
    const cat = this.filtroCat();
    this.editando.set({ id: null, form: {
      categoriaId: typeof cat === 'number' ? cat : (this.categorias()[0]?.id ?? null), nombre: '', descripcion: '',
      precio: 10000, costo: 0, imagenId: null, etiqueta: '', disponible: true, orden: this.productos().length + 1, grupos: [],
    } });
    window.scrollTo(0, 0);
  }

  protected editar(p: ProductoAdmin): void {
    this.errorForm.set('');
    const { id, slug: _slug, ...form } = structuredClone(p);
    this.editando.set({ id, form });
    window.scrollTo(0, 0);
  }

  protected duplicar(p: ProductoAdmin): void {
    const { id: _id, slug: _slug, ...form } = structuredClone(p);
    form.nombre = `${form.nombre} (copia)`;
    form.grupos = form.grupos.map((g) => ({ ...g, id: null, opciones: g.opciones.map((o) => ({ ...o, id: null })) }));
    this.errorForm.set('');
    this.editando.set({ id: null, form });
    window.scrollTo(0, 0);
  }

  protected imagen(id: number | null): void {
    this.editando.update((e) => e && { ...e, form: { ...e.form, imagenId: id } });
  }

  private conGrupos(f: (g: GrupoAdmin[]) => GrupoAdmin[]): void {
    this.editando.update((e) => e && { ...e, form: { ...e.form, grupos: f(e.form.grupos) } });
  }

  protected agregarGrupo(g?: GrupoAdmin): void {
    this.conGrupos((gs) => [...gs, g ?? { id: null, nombre: '', minimo: 0, maximo: 1, opciones: [{ id: null, nombre: '', precioExtra: 0, disponible: true }] }]);
  }
  protected quitarGrupo(i: number): void {
    this.conGrupos((gs) => gs.filter((_, j) => j !== i));
  }
  protected moverGrupo(i: number, d: number): void {
    this.conGrupos((gs) => {
      const l = [...gs];
      [l[i], l[i + d]] = [l[i + d]!, l[i]!];
      return l;
    });
  }
  protected agregarOpcion(g: GrupoAdmin): void {
    g.opciones = [...g.opciones, { id: null, nombre: '', precioExtra: 0, disponible: true }];
    this.conGrupos((gs) => [...gs]);
  }
  protected quitarOpcion(g: GrupoAdmin, i: number): void {
    g.opciones = g.opciones.filter((_, j) => j !== i);
    this.conGrupos((gs) => [...gs]);
  }

  protected guardar(): void {
    const e = this.editando();
    if (!e) return;
    const grupos = e.form.grupos.map((g) => ({
      ...g, nombre: g.nombre.trim(), minimo: Number(g.minimo) || 0, maximo: Number(g.maximo) || 1,
      opciones: g.opciones.filter((o) => o.nombre.trim()).map((o) => ({ ...o, nombre: o.nombre.trim(), precioExtra: Number(o.precioExtra) || 0 })),
    }));
    const f: ProductoForm = { ...e.form, nombre: e.form.nombre.trim(), precio: Number(e.form.precio), costo: Number(e.form.costo) || 0, orden: Number(e.form.orden) || 0, grupos };
    if (!f.nombre || !(f.precio > 0)) { this.errorForm.set('Escribe el nombre y un precio mayor a 0.'); return; }
    const malo = grupos.find((g) => !g.nombre || !g.opciones.length);
    if (malo) { this.errorForm.set('Cada grupo de opciones necesita un nombre y al menos una opción.'); return; }
    const imposible = grupos.find((g) => g.minimo > g.maximo || g.minimo > g.opciones.length);
    if (imposible) { this.errorForm.set(`Revisa «${imposible.nombre}»: el mínimo no puede ser mayor que el máximo ni que el número de opciones.`); return; }
    this.guardando.set(true);
    this.api.guardarProducto(e.id, f).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.avisos.mostrar('Producto guardado');
        this.cargar();
        this.estado.cargar();
      },
      error: (err) => { this.guardando.set(false); this.errorForm.set(mensajeError(err)); },
    });
  }

  protected disponible(p: ProductoAdmin): void {
    this.api.disponible(p.id, !p.disponible).subscribe({
      next: (n) => { this.productos.update((l) => l.map((x) => (x.id === n.id ? n : x))); this.estado.cargar(); },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  protected eliminar(p: ProductoAdmin): void {
    this.confirmar.set(null);
    this.api.eliminarProducto(p.id).subscribe({
      next: () => { this.avisos.mostrar('Producto eliminado'); this.cargar(); this.estado.cargar(); },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }
}
