import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { DineroPipe } from '../core/formato';
import { BibItem, Biblioteca, EmpresaResumen } from '../core/modelos';

const NOMBRE_FILTRO: Record<string, string> = {
  popular: 'Más pedidos', economico: 'Económico', 'para-compartir': 'Para compartir', 'para-hambrientos': 'Para hambrientos',
  picante: 'Picante', vegetariano: 'Vegetariano', dulce: 'Dulce', 'dulce-ahumado': 'Dulce ahumado', natural: 'Natural',
  infantil: 'Infantil', combo: 'Combo', carne: 'Con carne', pollo: 'Con pollo', queso: 'Con queso', tocineta: 'Con tocineta', huevo: 'Con huevo',
};

/**
 * Productos precargados (salchipapas, hamburguesas, pizzas...) para asignarle a una empresa. Se filtra por
 * categoría, etiqueta, precio y texto; se marcan los que se quieren y se copian al catálogo de la empresa.
 */
@Component({
  selector: 'app-biblioteca',
  imports: [FormsModule, DineroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel" style="margin-bottom:14px">
      <h3>Productos precargados</h3>
      <p class="muted">Elige los que quieras, con foto, precio y opciones ya armados, y asígnalos a una empresa. Cada empresa recibe su propia copia y después la edita a su gusto desde su portal.</p>
      <div class="bib-destino">
        <div class="field"><label for="bEmp">Asignar a la empresa</label>
          <select id="bEmp" [ngModel]="destino()" (ngModelChange)="destino.set($event)">
            <option value="">Elige una empresa…</option>
            @for (e of empresas(); track e.uuid) { <option [value]="e.uuid">{{ e.nombreComercial }} (/{{ e.identificador }})</option> }
          </select>
        </div>
        <div class="field"><label for="bAj">Ajuste de precios (%)</label>
          <input id="bAj" type="number" min="-50" max="200" step="5" [ngModel]="ajuste()" (ngModelChange)="ajuste.set(+$event || 0)">
          <span class="hint">Por ejemplo 10 sube todos un 10 %. Se redondea a $100.</span>
        </div>
      </div>
    </div>

    @if (error()) { <div class="alerta mala">{{ error() }}</div> }

    @if (lib(); as b) {
      <div class="bib-filtros panel">
        <div class="toolbar" style="margin:0">
          <input type="search" placeholder="Buscar (pizza, queso, picante…)" [ngModel]="texto()" (ngModelChange)="texto.set($event)" style="flex:1;min-width:200px">
          <label class="bib-precio">Hasta
            <select [ngModel]="tope()" (ngModelChange)="tope.set(+$event)">
              <option [ngValue]="0">Cualquier precio</option>
              @for (t of topes; track t) { <option [ngValue]="t">{{ t | dinero }}</option> }
            </select>
          </label>
          <button class="btn" type="button" (click)="limpiar()" [disabled]="!hayFiltros()">Limpiar filtros</button>
        </div>
        <div class="cats" role="group" aria-label="Categorías">
          <button type="button" [attr.aria-pressed]="!categoria()" (click)="categoria.set('')">Todas ({{ b.productos.length }})</button>
          @for (c of b.categorias; track c.nombre) {
            <button type="button" [attr.aria-pressed]="categoria() === c.nombre" (click)="categoria.set(categoria() === c.nombre ? '' : c.nombre)">{{ c.nombre }} ({{ c.cantidad }})</button>
          }
        </div>
        <div class="chips bib-etiquetas" role="group" aria-label="Etiquetas">
          @for (f of b.filtros; track f) {
            <button type="button" class="chip" [class.hot]="etiquetas().has(f)" [attr.aria-pressed]="etiquetas().has(f)" (click)="alternarEtiqueta(f)">{{ nombreFiltro(f) }}</button>
          }
        </div>
      </div>

      <div class="bib-barra">
        <span><b>{{ visibles().length }}</b> productos · <b>{{ seleccion().size }}</b> elegidos</span>
        <span class="row" style="gap:8px">
          <button class="btn" type="button" (click)="elegirVisibles()" [disabled]="!visibles().length">Elegir los {{ visibles().length }} que se ven</button>
          <button class="btn" type="button" (click)="seleccion.set(new_set())" [disabled]="!seleccion().size">Quitar selección</button>
        </span>
      </div>

      <div class="grid bib-grid">
        @for (p of visibles(); track p.slug) {
          <article class="card bib-card" [class.elegido]="seleccion().has(p.slug)">
            <button type="button" class="art" (click)="alternar(p.slug)" [attr.aria-pressed]="seleccion().has(p.slug)" [attr.aria-label]="'Elegir ' + p.nombre" style="border:0;padding:0;cursor:pointer;position:relative">
              @if (tieneFoto(p.slug)) {
                <img [src]="api.fotoBiblioteca(p.slug, version())" [alt]="p.nombre" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block">
              } @else {
                <span class="bib-sin" aria-hidden="true">{{ iniciales(p.nombre) }}<small>Sin foto</small></span>
              }
              <span class="bib-check" aria-hidden="true">{{ seleccion().has(p.slug) ? '✓' : '+' }}</span>
            </button>
            <div class="bib-foto">
              <label class="btn" style="cursor:pointer">
                {{ tieneFoto(p.slug) ? 'Cambiar foto' : 'Subir foto' }}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="subir(p.slug, $event)">
              </label>
              @if (esPropia(p.slug)) { <button class="btn" type="button" (click)="quitar(p.slug)">Quitar</button> }
            </div>
            <div class="body">
              <div class="chips">
                @if (p.etiqueta) { <span class="chip hot">{{ p.etiqueta }}</span> }
                <span class="chip">{{ p.categoria }}</span>
                @if (p.grupos.length) { <span class="chip">{{ resumenGrupos(p) }}</span> }
              </div>
              <h3>{{ p.nombre }}</h3>
              <p class="desc">{{ p.descripcion }}</p>
              <div class="buy"><span class="price num">{{ precioAjustado(p.precio) | dinero }}@if (ajuste()) {<s>{{ p.precio | dinero }}</s>}</span></div>
            </div>
          </article>
        } @empty {
          <div class="empty" style="grid-column:1/-1">Ningún producto coincide con esos filtros.</div>
        }
      </div>

      <div class="bib-accion">
        <span>
          @if (seleccion().size) { <b>{{ seleccion().size }}</b> {{ seleccion().size === 1 ? 'producto elegido' : 'productos elegidos' }} }
          @else { Marca los productos que quieras }
        </span>
        <button class="btn main" type="button" [disabled]="!puedeAsignar()" (click)="asignar()">
          {{ ocupado() ? 'Asignando…' : (nombreDestino() ? 'Asignar a ' + nombreDestino() : 'Elige una empresa') }}
        </button>
      </div>
    } @else if (!error()) {
      <div class="grid"><div class="esqueleto" style="height:300px"></div><div class="esqueleto" style="height:300px"></div><div class="esqueleto" style="height:300px"></div></div>
    }
  `,
  styles: `
    .bib-destino { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .bib-destino { grid-template-columns: 1fr; } }
    .bib-filtros { margin-bottom: 14px; }
    .bib-precio { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
    .bib-etiquetas .chip { border: 0; cursor: pointer; font-family: inherit; }
    .bib-barra { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .bib-grid { padding-bottom: 90px; }
    .bib-card { transition: box-shadow .15s, transform .15s, border-color .15s; }
    .bib-card.elegido { border-color: var(--brand, #c4372d); box-shadow: 0 0 0 2px var(--brand, #c4372d); }
    .bib-sin { width: 100%; height: 100%; display: grid; place-content: center; text-align: center; font-size: 42px; font-weight: 800;
      color: var(--brand, #c4372d); background: linear-gradient(135deg, #f6efe9, #efe3da); }
    .bib-sin small { font-size: 12px; font-weight: 600; color: #8a7f76; }
    .bib-foto { display: flex; gap: 8px; padding: 10px 14px 0; }
    .bib-check { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
      font-weight: 800; background: rgb(255 255 255 / .92); color: #333; box-shadow: 0 2px 8px rgb(0 0 0 / .25); }
    .elegido .bib-check { background: var(--brand, #c4372d); color: #fff; }
    .bib-accion { position: sticky; bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 10px 12px 10px 20px; box-shadow: 0 10px 30px rgb(0 0 0 / .18); }
  `,
})
export class BibliotecaPage {
  protected api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  /** Empresa preseleccionada (?empresa=uuid, desde el detalle de la empresa). */
  readonly empresa = input<string>('');

  protected lib = signal<Biblioteca | null>(null);
  protected empresas = signal<EmpresaResumen[]>([]);
  protected error = signal('');
  protected ocupado = signal(false);
  protected version = signal(Date.now());

  protected destino = signal('');
  protected ajuste = signal(0);
  protected texto = signal('');
  protected categoria = signal('');
  protected tope = signal(0);
  protected etiquetas = signal<Set<string>>(new Set());
  protected seleccion = signal<Set<string>>(new Set());
  protected readonly topes = [10000, 15000, 20000, 30000, 40000];

  protected visibles = computed<BibItem[]>(() => {
    const b = this.lib();
    if (!b) return [];
    const q = norm(this.texto());
    const cat = this.categoria();
    const tope = this.tope();
    const et = this.etiquetas();
    return b.productos.filter((p) =>
      (!cat || p.categoria === cat) &&
      (!tope || p.precio <= tope) &&
      [...et].every((f) => p.filtros.includes(f)) &&
      (!q || norm(`${p.nombre} ${p.descripcion} ${p.categoria} ${p.etiqueta} ${p.filtros.join(' ')}`).includes(q)));
  });

  protected hayFiltros = computed(() => !!(this.texto() || this.categoria() || this.tope() || this.etiquetas().size));
  protected nombreDestino = computed(() => this.empresas().find((e) => e.uuid === this.destino())?.nombreComercial ?? '');
  protected puedeAsignar = computed(() => !!this.destino() && this.seleccion().size > 0 && !this.ocupado());

  constructor() {
    this.api.biblioteca().subscribe({ next: (b) => this.lib.set(b), error: (e) => this.error.set(mensajeError(e)) });
    this.api.empresas().subscribe({
      next: (l) => this.empresas.set(l.filter((e) => e.estado === 'activa')),
      error: (e) => this.error.set(mensajeError(e)),
    });
    effect(() => { const e = this.empresa(); if (e) this.destino.set(e); });
  }

  protected tieneFoto(slug: string): boolean { return !!this.lib()?.conFoto.includes(slug); }
  protected esPropia(slug: string): boolean { return !!this.lib()?.fotosPropias.includes(slug); }
  protected iniciales(n: string): string { return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
  protected subir(slug: string, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.api.subirFotoBiblioteca(slug, f).subscribe({
      next: (b) => { this.lib.set(b); this.version.set(Date.now()); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }
  protected quitar(slug: string): void {
    this.api.quitarFotoBiblioteca(slug).subscribe({
      next: (b) => { this.lib.set(b); this.version.set(Date.now()); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  protected new_set(): Set<string> { return new Set(); }
  protected nombreFiltro(f: string): string { return NOMBRE_FILTRO[f] ?? f; }
  protected resumenGrupos(p: BibItem): string { return p.grupos.map((g) => g.nombre).join(' · '); }
  protected precioAjustado(precio: number): number {
    return Math.max(100, Math.round((precio * (100 + this.ajuste())) / 100 / 100) * 100);
  }

  protected alternar(slug: string): void {
    const s = new Set(this.seleccion());
    if (!s.delete(slug)) s.add(slug);
    this.seleccion.set(s);
  }
  protected elegirVisibles(): void {
    const s = new Set(this.seleccion());
    this.visibles().forEach((p) => s.add(p.slug));
    this.seleccion.set(s);
  }
  protected alternarEtiqueta(f: string): void {
    const s = new Set(this.etiquetas());
    if (!s.delete(f)) s.add(f);
    this.etiquetas.set(s);
  }
  protected limpiar(): void {
    this.texto.set(''); this.categoria.set(''); this.tope.set(0); this.etiquetas.set(new Set());
  }

  protected asignar(): void {
    if (!this.puedeAsignar()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.api.importarBiblioteca(this.destino(), [...this.seleccion()], this.ajuste()).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.seleccion.set(new Set());
        const omit = r.omitidos ? ` (${r.omitidos} ya estaban)` : '';
        this.avisos.mostrar(`${r.importados} ${r.importados === 1 ? 'producto agregado' : 'productos agregados'} a ${this.nombreDestino()}${omit}`);
      },
      error: (e) => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }
}

function norm(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
