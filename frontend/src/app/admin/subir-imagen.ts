import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { AdminApi, mensajeError, urlImagen } from '../core/api';

/** Botón para subir una imagen (logo o foto de producto) con vista previa. */
@Component({
  selector: 'app-subir-imagen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="subir">
      <div class="vista">
        @if (url(imagenId()); as u) { <img [src]="u" alt="Vista previa"> } @else { Sin imagen }
      </div>
      <div class="stack" style="gap:6px">
        <label class="btn" style="cursor:pointer">
          {{ subiendo() ? 'Subiendo…' : (imagenId() ? 'Cambiar imagen' : 'Subir imagen') }}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="subir($event)" [disabled]="subiendo()">
        </label>
        @if (imagenId()) { <button class="linkbtn" type="button" (click)="cambio.emit(null)">Quitar</button> }
        <span class="hint">PNG, JPG o WebP de hasta 2 MB. {{ ayuda() }}</span>
        @if (error()) { <span class="err">{{ error() }}</span> }
      </div>
    </div>
  `,
})
export class SubirImagen {
  private api = inject(AdminApi);
  readonly imagenId = input<number | null>(null);
  readonly ayuda = input('');
  readonly cambio = output<number | null>();
  protected subiendo = signal(false);
  protected error = signal('');

  protected url(id: number | null): string | null { return urlImagen(id); }

  protected subir(ev: Event): void {
    const campo = ev.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    if (archivo.size > 2 * 1024 * 1024) { this.error.set('La imagen pesa más de 2 MB. Usa una más liviana.'); return; }
    this.subiendo.set(true);
    this.error.set('');
    this.api.subirImagen(archivo).subscribe({
      next: (r) => { this.subiendo.set(false); this.cambio.emit(r.id); },
      error: (e) => { this.subiendo.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
