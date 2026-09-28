import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DiaCortoPipe, etiquetaPromo } from '../core/formato';
import { ProductoAdmin, PromocionAdmin, PromocionForm, TipoPromocion } from '../core/modelos';

const VACIA: PromocionForm = {
  nombre: '', descripcion: '', tipo: 'COMBO', cantidad: 3, precio: 17000, porcentaje: 10, minimo: 0,
  productoId: null, productoIds: [], activa: true, destacada: true, desde: null, hasta: null,
};

@Component({
  selector: 'app-promociones',
  imports: [FormsModule, DiaCortoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <button class="btn main" (click)="nueva()">+ Nueva promoción</button>
      <span class="muted">Si un pedido cumple varias, se aplica la que más descuenta. El domicilio gratis se suma aparte.</span>
    </div>

    @if (editando(); as e) {
      <form class="editor" (ngSubmit)="guardar()">
        <h3>{{ e.id ? 'Editar promoción' : 'Nueva promoción' }}</h3>
        <div class="field"><label for="tipo">Tipo</label>
          <select id="tipo" name="tipo" [(ngModel)]="e.form.tipo">
            @for (t of tipos; track t.k) { <option [value]="t.k">{{ t.t }}</option> }
          </select></div>
        <div class="field"><label for="nombre">Nombre</label>
          <input id="nombre" name="nombre" [(ngModel)]="e.form.nombre" placeholder="Ej: Combo familiar"></div>
        <div class="field"><label for="desc">Texto para los clientes <span class="hint">(opcional)</span></label>
          <input id="desc" name="desc" [(ngModel)]="e.form.descripcion"></div>

        @switch (e.form.tipo) {
          @case ('COMBO') {
            <div class="row2">
              <div class="field"><label for="cant">Cantidad de productos</label><input id="cant" name="cant" type="number" min="2" [(ngModel)]="e.form.cantidad"></div>
              <div class="field"><label for="precio">Precio del combo</label><input id="precio" name="precio" type="number" min="0" step="500" [(ngModel)]="e.form.precio"></div>
            </div>
          }
          @case ('PORCENTAJE') {
            <div class="row2">
              <div class="field"><label for="pct">Porcentaje</label><input id="pct" name="pct" type="number" min="1" max="90" [(ngModel)]="e.form.porcentaje"></div>
              <div class="field"><label for="min">Compra mínima</label><input id="min" name="min" type="number" min="0" step="1000" [(ngModel)]="e.form.minimo"></div>
            </div>
          }
          @case ('PRECIO_ESPECIAL') {
            <div class="row2">
              <div class="field"><label for="prod">Producto</label>
                <select id="prod" name="prod" [(ngModel)]="e.form.productoId">
                  @for (p of productos(); track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
                </select></div>
              <div class="field"><label for="precioEsp">Precio especial</label><input id="precioEsp" name="precioEsp" type="number" min="0" step="100" [(ngModel)]="e.form.precio"></div>
            </div>
          }
          @case ('ENVIO_GRATIS') {
            <div class="field"><label for="minEnvio">Pedido mínimo para domicilio gratis</label>
              <input id="minEnvio" name="minEnvio" type="number" min="0" step="1000" [(ngModel)]="e.form.minimo"></div>
          }
        }

        @if (e.form.tipo === 'COMBO' || e.form.tipo === 'PORCENTAJE') {
          <div class="field"><span class="flabel">Aplica a</span>
            <div class="layers">
              @for (p of productos(); track p.id) {
                <label class="check"><input type="checkbox" [checked]="incluido(p.id)" (change)="alternar(p.id)"> {{ p.nombre }}</label>
              }
            </div>
            <span class="hint">Sin marcar ninguno aplica a todos los productos, también a los nuevos. En los combos, las adiciones se cobran aparte.</span>
          </div>
        }
        <div class="row2">
          <div class="field"><label for="desde">Desde <span class="hint">(opcional)</span></label><input id="desde" name="desde" type="date" [(ngModel)]="e.form.desde"></div>
          <div class="field"><label for="hasta">Hasta <span class="hint">(opcional)</span></label><input id="hasta" name="hasta" type="date" [(ngModel)]="e.form.hasta"></div>
        </div>
        <span class="hint">Las fechas se comparan con el día del pedido (o el día de entrega, si trabajas con entregas programadas).</span>
        <label class="check"><input type="checkbox" name="activa" [(ngModel)]="e.form.activa"> Activa</label>
        <label class="check"><input type="checkbox" name="destacada" [(ngModel)]="e.form.destacada"> Mostrar en la tienda</label>
        @if (errorForm()) { <p class="err">{{ errorForm() }}</p> }
        <div class="row"><button class="btn main" type="submit">Guardar promoción</button>
          <button class="btn" type="button" (click)="editando.set(null)">Cancelar</button></div>
      </form>
    }

    <div class="plist">
      @for (p of promociones(); track p.id) {
        <div class="pitem">
          <span class="chip hot num" style="font-size:14px">{{ etiqueta(p) }}</span>
          <div>
            <b>{{ p.nombre }}</b>
            <span class="st" [class.pay-RECIBIDO]="p.vigente" [class.pay-PENDIENTE]="!p.vigente">{{ p.vigente ? 'Activa ahora' : 'Inactiva' }}</span>
            <div class="meta">{{ p.descripcion }}
              @if (p.desde) { · desde {{ p.desde | diaCorto }} } @if (p.hasta) { · hasta {{ p.hasta | diaCorto }} }
              @if (p.destacada) { · visible en la tienda }</div>
          </div>
          <div class="acts">
            <button class="btn" (click)="activar(p)">{{ p.activa ? 'Pausar' : 'Activar' }}</button>
            <button class="btn" (click)="editar(p)">Editar</button>
            @if (confirmar() === p.id) {
              <button class="btn sure" (click)="eliminar(p)">Sí, eliminar</button>
              <button class="btn" (click)="confirmar.set(null)">No</button>
            } @else {
              <button class="btn bad" (click)="confirmar.set(p.id)">Eliminar</button>
            }
          </div>
        </div>
      } @empty {
        <div class="empty">No hay promociones.</div>
      }
    </div>
  `,
})
export class PromocionesPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);

  protected tipos: { k: TipoPromocion; t: string }[] = [
    { k: 'COMBO', t: 'Combo: varios productos por un precio' },
    { k: 'PORCENTAJE', t: 'Descuento en porcentaje' },
    { k: 'PRECIO_ESPECIAL', t: 'Precio especial en un producto' },
    { k: 'ENVIO_GRATIS', t: 'Domicilio gratis desde un monto' },
  ];

  protected promociones = signal<PromocionAdmin[]>([]);
  protected productos = signal<ProductoAdmin[]>([]);
  protected editando = signal<{ id: number | null; form: PromocionForm } | null>(null);
  protected errorForm = signal('');
  protected confirmar = signal<number | null>(null);

  constructor() {
    this.cargar();
    this.api.productos().subscribe((l) => this.productos.set(l));
  }

  private cargar(): void {
    this.api.promociones().subscribe({ next: (l) => this.promociones.set(l), error: (e) => this.avisos.mostrar(mensajeError(e)) });
  }

  protected etiqueta(p: PromocionAdmin): string { return etiquetaPromo(p); }

  protected nueva(): void {
    this.errorForm.set('');
    this.editando.set({ id: null, form: { ...VACIA, productoIds: [], productoId: this.productos()[0]?.id ?? null } });
  }

  protected editar(p: PromocionAdmin): void {
    this.errorForm.set('');
    const { id, vigente: _v, ...form } = p;
    this.editando.set({ id, form: { ...VACIA, ...form, productoIds: [...form.productoIds],
      cantidad: form.cantidad ?? 3, precio: form.precio ?? 0, porcentaje: form.porcentaje ?? 10 } });
    window.scrollTo(0, 0);
  }

  protected incluido(id: number): boolean {
    return this.editando()?.form.productoIds.includes(id) ?? false;
  }

  protected alternar(id: number): void {
    this.editando.update((e) => {
      if (!e) return e;
      const ids = e.form.productoIds.includes(id) ? e.form.productoIds.filter((x) => x !== id) : [...e.form.productoIds, id];
      return { ...e, form: { ...e.form, productoIds: ids } };
    });
  }

  protected guardar(): void {
    const e = this.editando();
    if (!e) return;
    const f = e.form;
    const datos: PromocionForm = {
      ...f,
      cantidad: f.cantidad == null ? null : Number(f.cantidad),
      precio: f.precio == null ? null : Number(f.precio),
      porcentaje: f.porcentaje == null ? null : Number(f.porcentaje),
      minimo: Number(f.minimo) || 0,
      desde: f.desde || null,
      hasta: f.hasta || null,
    };
    if (!datos.nombre.trim()) { this.errorForm.set('Escribe un nombre para la promoción.'); return; }
    this.api.guardarPromocion(e.id, datos).subscribe({
      next: () => { this.editando.set(null); this.avisos.mostrar('Promoción guardada'); this.cargar(); },
      error: (err) => this.errorForm.set(mensajeError(err)),
    });
  }

  protected activar(p: PromocionAdmin): void {
    this.api.activarPromocion(p.id, !p.activa).subscribe({
      next: (n) => this.promociones.update((l) => l.map((x) => (x.id === n.id ? n : x))),
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  protected eliminar(p: PromocionAdmin): void {
    this.confirmar.set(null);
    this.api.eliminarPromocion(p.id).subscribe({
      next: () => { this.avisos.mostrar('Promoción eliminada'); this.cargar(); },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }
}
