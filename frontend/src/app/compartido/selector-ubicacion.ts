import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { dinero } from '../core/formato';
import { EntregaPublica } from '../core/modelos';
import { Mapa, Marcador, buscarDireccion, kmEntre, miUbicacion } from './mapa';

/**
 * «¿Dónde te lo llevamos?» para el domicilio por distancia: el cliente busca su dirección, usa su ubicación o
 * toca el mapa, y ajusta el pin. Muestra a cuántos km queda y cuánto vale el domicilio (el servidor lo confirma).
 */
@Component({
  selector: 'app-selector-ubicacion',
  imports: [FormsModule, Mapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <span class="flabel">¿Dónde te lo llevamos?</span>
      <div class="ubicacion-acciones">
        <input name="buscarDir" [ngModel]="texto()" (ngModelChange)="texto.set($event)" (keydown.enter)="$event.preventDefault(); buscar()"
               placeholder="Escribe tu dirección y barrio" autocomplete="street-address">
        <button class="btn" type="button" [disabled]="buscando() || !texto().trim()" (click)="buscar()">{{ buscando() ? 'Buscando…' : 'Buscar' }}</button>
        <button class="btn" type="button" [disabled]="ubicando()" (click)="usarMiUbicacion()">📍 {{ ubicando() ? 'Ubicando…' : 'Mi ubicación' }}</button>
      </div>
      @if (resultados().length) {
        <ul class="resultados-direccion">
          @for (r of resultados(); track $index) {
            <li><button type="button" (click)="elegir(r)">{{ r.nombre }}</button></li>
          }
        </ul>
      }
      @if (aviso()) { <span class="hint">{{ aviso() }}</span> }
      <app-mapa [marcadores]="marcadores()" movible="destino" [radioKm]="entrega().radioKm" [alto]="260"
                etiqueta="Mapa para escoger dónde entregar" (movido)="ubicacion.set($event)" />
      @if (ubicacion(); as u) {
        @if (estado(); as e) {
          <span [class.err]="e.fuera" class="hint" style="font-size:13.5px">
            {{ e.fuera ? 'Tu punto queda a ' + e.km + ' km y llevamos hasta ' + entrega().radioKm + ' km.' : 'A ' + e.km + ' km del local · domicilio ' + e.valor }}
          </span>
        }
        <span class="hint">Si el pin no quedó exacto, arrástralo o toca el mapa en tu puerta.</span>
      } @else {
        <span class="hint">Busca tu dirección, usa tu ubicación o toca el mapa donde quieres recibirlo.</span>
      }
    </div>
  `,
})
export class SelectorUbicacion {
  readonly entrega = input.required<EntregaPublica>();
  readonly ciudad = input('');
  /** Punto escogido (null mientras no escoja). */
  readonly ubicacion = model<{ lat: number; lng: number } | null>(null);

  protected texto = signal('');
  protected buscando = signal(false);
  protected ubicando = signal(false);
  protected aviso = signal('');
  protected resultados = signal<{ nombre: string; lat: number; lng: number }[]>([]);

  private local = computed(() => {
    const e = this.entrega();
    return e.localLat != null && e.localLng != null ? { lat: e.localLat, lng: e.localLng } : null;
  });

  protected marcadores = computed<Marcador[]>(() => {
    const l = this.local();
    const u = this.ubicacion();
    const lista: Marcador[] = [];
    if (l) lista.push({ id: 'local', ...l, tipo: 'local', texto: 'Nuestro local' });
    if (u) lista.push({ id: 'destino', ...u, tipo: 'destino', texto: 'Aquí lo entregamos' });
    return lista;
  });

  /** Lo mismo que calcula el servidor: km en línea recta y el primer tramo que alcanza. */
  protected estado = computed(() => {
    const l = this.local();
    const u = this.ubicacion();
    if (!l || !u) return null;
    const km = kmEntre(l, u);
    const tramo = this.entrega().tramos.find((t) => km <= t.hastaKm + 1e-9);
    return { km: km.toLocaleString('es-CO', { maximumFractionDigits: 1 }), fuera: !tramo, valor: tramo ? dinero(tramo.valor) : '' };
  });

  protected async buscar(): Promise<void> {
    const q = this.texto().trim();
    if (!q) return;
    this.buscando.set(true);
    this.aviso.set('');
    try {
      const r = await buscarDireccion(q, this.local(), this.ciudad());
      if (!r.length) this.aviso.set('No encontramos esa dirección. Prueba con el barrio o toca el mapa donde vives.');
      if (r.length === 1) this.elegir(r[0]!);
      else this.resultados.set(r);
    } catch {
      this.aviso.set('No pudimos buscar la dirección. Toca el mapa donde vives.');
    } finally {
      this.buscando.set(false);
    }
  }

  protected elegir(r: { lat: number; lng: number }): void {
    this.resultados.set([]);
    this.ubicacion.set({ lat: r.lat, lng: r.lng });
    this.aviso.set('Revisa que el pin quede en tu puerta; si no, muévelo.');
  }

  protected async usarMiUbicacion(): Promise<void> {
    this.ubicando.set(true);
    this.aviso.set('');
    try {
      const u = await miUbicacion();
      this.ubicacion.set({ lat: u.lat, lng: u.lng });
      if (u.precision > 150) this.aviso.set('Tu ubicación es aproximada: ajusta el pin en el mapa.');
    } catch (e) {
      this.aviso.set((e as Error).message + ' Busca tu dirección o toca el mapa.');
    } finally {
      this.ubicando.set(false);
    }
  }
}
