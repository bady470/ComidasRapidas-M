import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mapa, Marcador, buscarDireccion, miUbicacion } from '../compartido/mapa';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EstadoTienda } from '../core/estado-tienda';
import { dinero } from '../core/formato';
import { ConfigMapa, Tramo } from '../core/modelos';

const TRAMOS_SUGERIDOS: Tramo[] = [{ hastaKm: 2, valor: 3000 }, { hastaKm: 4, valor: 5000 }, { hastaKm: 7, valor: 8000 }];

/**
 * Dónde queda el local, cómo se cobra el domicilio (valor fijo/zonas o por distancia en tramos de km) y si el cliente
 * ve en vivo a su domiciliario.
 */
@Component({
  selector: 'app-mapa-config',
  imports: [FormsModule, Mapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h"><h1>Domicilios y mapa</h1></div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (f(); as c) {
      <div class="grid-g">
        <section class="panel">
          <h3>¿Dónde queda tu local?</h3>
          <div class="ubicacion-acciones">
            <input name="buscarLocal" [ngModel]="texto()" (ngModelChange)="texto.set($event)" (keydown.enter)="$event.preventDefault(); buscar()" placeholder="Dirección del local, ciudad">
            <button class="btn" type="button" [disabled]="buscando()" (click)="buscar()">Buscar</button>
            <button class="btn" type="button" (click)="aqui()">📍 Estoy en el local</button>
          </div>
          @if (resultados().length) {
            <ul class="resultados-direccion">
              @for (r of resultados(); track $index) { <li><button type="button" (click)="poner(r)">{{ r.nombre }}</button></li> }
            </ul>
          }
          <app-mapa [marcadores]="marcadores()" movible="local" [radioKm]="c.modo === 'DISTANCIA' ? radio() : null" [alto]="340"
                    etiqueta="Ubicación del local" (movido)="poner($event)" />
          <span class="hint">{{ c.localLat != null ? 'Arrastra el pin o toca el mapa para ajustarlo a la puerta del local.' : 'Busca la dirección, usa tu ubicación o toca el mapa.' }}</span>
        </section>

        <form class="panel" (ngSubmit)="guardar()">
          <h3>¿Cómo cobras el domicilio?</h3>
          <div class="opts">
            <label class="opt"><input type="radio" name="modo" value="FIJO" [ngModel]="c.modo" (ngModelChange)="cambiar({ modo: $event })">
              <span><b>Valor fijo o por zonas</b><br><span class="muted">El que configuras en «Mi tienda → Entrega».</span></span></label>
            <label class="opt"><input type="radio" name="modo" value="DISTANCIA" [ngModel]="c.modo" (ngModelChange)="cambiar({ modo: $event })">
              <span><b>Según la distancia</b><br><span class="muted">El cliente marca su punto en el mapa y el valor sale solo.</span></span></label>
          </div>

          @if (c.modo === 'DISTANCIA') {
            <div class="field"><span class="flabel">Tramos <span class="hint">(km en línea recta desde el local)</span></span>
              @for (t of c.tramos; track $index; let i = $index) {
                <div class="row" style="gap:8px">
                  <span class="muted" style="min-width:44px">Hasta</span>
                  <input type="number" min="0.1" max="50" step="0.5" [name]="'km' + i" [ngModel]="t.hastaKm" (ngModelChange)="tramo(i, { hastaKm: +$event })" style="width:90px" aria-label="Kilómetros">
                  <span class="muted">km</span>
                  <input type="number" min="0" step="500" [name]="'v' + i" [ngModel]="t.valor" (ngModelChange)="tramo(i, { valor: +$event })" style="width:120px" aria-label="Valor del domicilio">
                  <button class="linkbtn" type="button" (click)="quitar(i)" aria-label="Quitar tramo">Quitar</button>
                </div>
              }
              <div class="row" style="gap:8px">
                @if (c.tramos.length < 10) { <button class="btn" type="button" (click)="agregar()">+ Agregar tramo</button> }
                @if (!c.tramos.length) { <button class="linkbtn" type="button" (click)="cambiar({ tramos: sugeridos })">Usar unos de ejemplo</button> }
              </div>
              @if (c.tramos.length) {
                <span class="hint">Llevas domicilios hasta {{ radio() }} km (el círculo del mapa). {{ resumen() }}</span>
              }
            </div>
          }

          <label class="check" style="margin-top:6px"><input type="checkbox" name="vivo" [ngModel]="c.seguimientoVivo" (ngModelChange)="cambiar({ seguimientoVivo: $event })">
            El cliente ve a su domiciliario en el mapa cuando su pedido va en camino</label>
          <span class="hint">Cada domiciliario tiene su link de reparto en «Domiciliarios»; con él comparte su ubicación desde el celular.</span>

          <div><button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button></div>
        </form>
      </div>
    }
  `,
})
export class MapaConfigPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  private estado = inject(EstadoTienda);

  protected readonly sugeridos = TRAMOS_SUGERIDOS;
  protected f = signal<ConfigMapa | null>(null);
  protected error = signal('');
  protected guardando = signal(false);
  protected texto = signal('');
  protected buscando = signal(false);
  protected resultados = signal<{ nombre: string; lat: number; lng: number }[]>([]);

  protected marcadores = computed<Marcador[]>(() => {
    const c = this.f();
    return c?.localLat != null && c.localLng != null ? [{ id: 'local', lat: c.localLat, lng: c.localLng, tipo: 'local', texto: 'Tu local' }] : [];
  });
  protected radio = computed(() => Math.max(0, ...(this.f()?.tramos ?? []).map((t) => t.hastaKm)));
  protected resumen = computed(() => [...(this.f()?.tramos ?? [])].sort((a, b) => a.hastaKm - b.hastaKm)
    .map((t) => `hasta ${t.hastaKm} km ${dinero(t.valor)}`).join(' · '));

  constructor() {
    this.api.configMapa().subscribe({ next: (c) => this.f.set(c), error: (e) => this.error.set(mensajeError(e)) });
    const t = this.estado.catalogo()?.tienda;
    if (t) this.texto.set([t.direccion, t.ciudad].filter(Boolean).join(', '));
  }

  protected cambiar(p: Partial<ConfigMapa>): void { this.f.update((c) => c && { ...c, ...p }); }
  protected tramo(i: number, p: Partial<Tramo>): void { this.f.update((c) => c && { ...c, tramos: c.tramos.map((t, j) => (j === i ? { ...t, ...p } : t)) }); }
  protected quitar(i: number): void { this.f.update((c) => c && { ...c, tramos: c.tramos.filter((_, j) => j !== i) }); }
  protected agregar(): void {
    this.f.update((c) => {
      if (!c) return c;
      const ultimo = c.tramos[c.tramos.length - 1];
      return { ...c, tramos: [...c.tramos, { hastaKm: (ultimo?.hastaKm ?? 0) + 2, valor: (ultimo?.valor ?? 2000) + 2000 }] };
    });
  }

  protected poner(p: { lat: number; lng: number }): void {
    this.resultados.set([]);
    this.cambiar({ localLat: p.lat, localLng: p.lng });
  }

  protected async buscar(): Promise<void> {
    if (!this.texto().trim()) return;
    this.buscando.set(true);
    try {
      const c = this.f();
      const r = await buscarDireccion(this.texto(), c?.localLat != null && c.localLng != null ? { lat: c.localLat, lng: c.localLng } : null);
      if (!r.length) this.avisos.mostrar('No encontramos esa dirección: toca el mapa donde queda el local.');
      if (r.length === 1) this.poner(r[0]!); else this.resultados.set(r);
    } catch {
      this.avisos.mostrar('No pudimos buscar la dirección. Toca el mapa donde queda el local.');
    } finally {
      this.buscando.set(false);
    }
  }

  protected async aqui(): Promise<void> {
    try { this.poner(await miUbicacion()); } catch (e) { this.avisos.mostrar((e as Error).message); }
  }

  protected guardar(): void {
    const c = this.f();
    if (!c) return;
    this.guardando.set(true);
    this.error.set('');
    this.api.guardarConfigMapa({ ...c, tramos: c.tramos.filter((t) => t.hastaKm > 0) }).subscribe({
      next: (r) => { this.guardando.set(false); this.f.set(r); this.estado.cargar(); this.avisos.mostrar('Guardado'); },
      error: (e) => { this.guardando.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
