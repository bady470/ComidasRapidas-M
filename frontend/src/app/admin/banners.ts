import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Slide } from '../compartido/slide';
import { Icono } from '../compartido/icono';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { BannerAdmin, BannerForm } from '../core/modelos';
import { SubirImagen } from './subir-imagen';

const VACIO: BannerForm = { titulo: '', subtitulo: '', boton: 'Pedir ahora', imagenId: null, color: '', activo: true };
const COLORES = ['', '#DC2626', '#EA580C', '#CA8A04', '#15803D', '#0D9488', '#1D4ED8', '#7C3AED', '#DB2777', '#111827'];

/** El administrador arma aquí el carrusel de la portada de su tienda: lo que ve, lo ve igual el cliente. */
@Component({
  selector: 'app-banners',
  imports: [FormsModule, Slide, Icono, SubirImagen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <button class="btn main" type="button" (click)="nuevo()"><app-icono nombre="nueva" /> Nuevo banner</button>
      <span class="muted">Los banners se turnan en la portada de tu tienda. Arrástralos con las flechas para cambiar el orden.</span>
    </div>

    @if (editando(); as e) {
      <form class="editor ban-editor" (ngSubmit)="guardar()">
        <div class="ban-form">
          <h3>{{ e.id ? 'Editar banner' : 'Nuevo banner' }}</h3>
          <div class="field"><label for="bt">Título</label>
            <input id="bt" name="bt" maxlength="80" placeholder="Ej: Martes de perros 2x1" [(ngModel)]="e.form.titulo"></div>
          <div class="field"><label for="bs">Texto de apoyo <span class="hint">(opcional)</span></label>
            <input id="bs" name="bs" maxlength="200" placeholder="Ej: Todo el día, solo hoy" [(ngModel)]="e.form.subtitulo"></div>
          <div class="field"><label for="bb">Texto del botón <span class="hint">(opcional)</span></label>
            <input id="bb" name="bb" maxlength="30" [(ngModel)]="e.form.boton"></div>
          <div class="field"><span class="flabel">Color de fondo</span>
            <div class="ban-colores">
              @for (c of colores; track c) {
                <button type="button" class="ban-color" [class.on]="e.form.color === c" [style.background]="c || 'linear-gradient(120deg, var(--brand), var(--brand-2))'"
                        (click)="e.form.color = c" [attr.aria-label]="c ? 'Color ' + c : 'Color de mi marca'" [title]="c || 'Color de mi marca'"></button>
              }
            </div></div>
          <div class="field"><span class="flabel">Foto de fondo <span class="hint">(opcional; mejor horizontal)</span></span>
            <app-subir-imagen [imagenId]="e.form.imagenId" ayuda="Se recomienda 1200×500 px." (cambio)="e.form.imagenId = $event" /></div>
          <label class="check"><input type="checkbox" name="ba" [(ngModel)]="e.form.activo"> Mostrar en la tienda</label>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <div class="row">
            <button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar banner' }}</button>
            <button class="btn" type="button" (click)="editando.set(null)">Cancelar</button>
          </div>
        </div>
        <div class="ban-prev">
          <span class="lbl">Así lo verá el cliente</span>
          <div class="ban-marco"><app-slide [titulo]="e.form.titulo" [subtitulo]="e.form.subtitulo" [boton]="e.form.boton" [imagenId]="e.form.imagenId" [color]="e.form.color" /></div>
        </div>
      </form>
    }

    @if (cargado() && !banners().length && !editando()) {
      <div class="empty">
        <p><b>Todavía no tienes banners.</b></p>
        <p class="muted">Crea el primero para destacar una promoción, un producto nuevo o un aviso en la portada de tu tienda.</p>
        <p style="margin-top:12px"><button class="btn main" type="button" (click)="nuevo()">Crear mi primer banner</button></p>
      </div>
    }

    <div class="ban-lista">
      @for (b of banners(); track b.id; let i = $index) {
        <div class="ban-fila" [class.apagado]="!b.activo">
          <div class="ban-mini"><app-slide [titulo]="b.titulo" [subtitulo]="b.subtitulo" [boton]="b.boton" [imagenId]="b.imagenId" [color]="b.color" /></div>
          <div class="ban-info">
            <div class="ban-meta">
              <span class="ban-orden">Banner {{ i + 1 }}</span>
              <span class="chip" [class.hot]="b.activo">{{ b.activo ? 'Visible en la tienda' : 'Oculto' }}</span>
            </div>
            <h4>{{ b.titulo }}</h4>
            @if (b.subtitulo) { <p class="muted">{{ b.subtitulo }}</p> }
          </div>
          <div class="ban-acciones">
            <div class="row">
              <button class="btn" type="button" (click)="mover(i, -1)" [disabled]="i === 0" aria-label="Subir">↑</button>
              <button class="btn" type="button" (click)="mover(i, 1)" [disabled]="i === banners().length - 1" aria-label="Bajar">↓</button>
              <button class="btn" type="button" (click)="alternar(b)">{{ b.activo ? 'Ocultar' : 'Mostrar' }}</button>
              <button class="btn" type="button" (click)="editar(b)">Editar</button>
              <button class="btn bad" type="button" (click)="borrar(b)">Borrar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: 16px; }
    .ban-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 24px; align-items: start; }
    .ban-form { display: grid; gap: 14px; }
    .ban-prev { display: grid; gap: 8px; position: sticky; top: 76px; }
    .ban-marco { aspect-ratio: 16 / 6; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 1px var(--line); }
    .ban-colores { display: flex; flex-wrap: wrap; gap: 8px; }
    .ban-color { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line); cursor: pointer; padding: 0; }
    .ban-color.on { box-shadow: 0 0 0 2px var(--brand); }
    .ban-lista { display: grid; gap: 12px; }
    .ban-fila { display: grid; grid-template-columns: minmax(200px, 320px) minmax(0, 1fr) auto; gap: 20px; align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: 14px; }
    .ban-info { display: grid; gap: 6px; align-content: center; min-width: 0; }
    .ban-info h4 { font-size: 16px; font-weight: 700; margin: 0; overflow-wrap: anywhere; }
    .ban-info p { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
    .ban-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ban-orden { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
    .ban-fila.apagado .ban-mini { opacity: .45; filter: grayscale(.6); }
    .ban-mini { aspect-ratio: 16 / 7; border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 1px var(--line); }
    .ban-acciones { display: grid; justify-items: end; }
    .ban-acciones .btn { min-width: 38px; text-align: center; }
    @media (max-width: 1100px) { .ban-fila { grid-template-columns: minmax(200px, 280px) minmax(0, 1fr); } .ban-acciones { grid-column: 1 / -1; justify-items: start; } }
    @media (max-width: 900px) { .ban-editor { grid-template-columns: minmax(0, 1fr); } .ban-prev { position: static; } }
    @media (max-width: 600px) { .ban-fila { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class BannersPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);

  protected readonly colores = COLORES;
  protected banners = signal<BannerAdmin[]>([]);
  protected cargado = signal(false);
  protected editando = signal<{ id: number | null; form: BannerForm } | null>(null);
  protected guardando = signal(false);
  protected error = signal('');

  constructor() {
    this.api.banners().subscribe({
      next: (l) => { this.banners.set(l); this.cargado.set(true); },
      error: (e) => { this.cargado.set(true); this.avisos.mostrar(mensajeError(e)); },
    });
  }

  protected nuevo(): void { this.error.set(''); this.editando.set({ id: null, form: { ...VACIO } }); }

  protected editar(b: BannerAdmin): void {
    this.error.set('');
    this.editando.set({ id: b.id, form: { titulo: b.titulo, subtitulo: b.subtitulo, boton: b.boton, imagenId: b.imagenId, color: b.color, activo: b.activo } });
  }

  protected guardar(): void {
    const e = this.editando();
    if (!e) return;
    if (!e.form.titulo.trim()) { this.error.set('Escribe el título del banner.'); return; }
    this.guardando.set(true);
    this.error.set('');
    this.api.guardarBanner(e.id, e.form).subscribe({
      next: (l) => { this.banners.set(l); this.guardando.set(false); this.editando.set(null); this.avisos.mostrar('Banner guardado'); },
      error: (err) => { this.guardando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  protected alternar(b: BannerAdmin): void {
    this.api.guardarBanner(b.id, { titulo: b.titulo, subtitulo: b.subtitulo, boton: b.boton, imagenId: b.imagenId, color: b.color, activo: !b.activo })
      .subscribe({ next: (l) => this.banners.set(l), error: (e) => this.avisos.mostrar(mensajeError(e)) });
  }

  protected mover(i: number, d: number): void {
    const ids = this.banners().map((b) => b.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.api.ordenarBanners(ids).subscribe({ next: (l) => this.banners.set(l), error: (e) => this.avisos.mostrar(mensajeError(e)) });
  }

  protected borrar(b: BannerAdmin): void {
    if (!confirm(`¿Borrar el banner «${b.titulo}»?`)) return;
    this.api.eliminarBanner(b.id).subscribe({ next: (l) => { this.banners.set(l); this.avisos.mostrar('Banner borrado'); }, error: (e) => this.avisos.mostrar(mensajeError(e)) });
  }
}
