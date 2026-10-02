import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mapa, Marcador, buscarDireccion } from '../compartido/mapa';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EstadoTienda } from '../core/estado-tienda';
import { dinero } from '../core/formato';
import { DIAS, MODULOS, MenuSedes, PanelSedes, SedeAdmin, SedeForm, Tramo } from '../core/modelos';

const HORARIO_BASE = [1, 2, 3, 4, 5, 6, 7].map((dia) => ({ dia, activo: true, abre: '10:00', cierra: '22:00' }));

/**
 * Sedes de la empresa: cómo funciona el menú (igual en todas o personalizado por sede) y los datos de cada sede
 * (dirección, ubicación, tramos de domicilio, horario, tiempos, abierta).
 */
@Component({
  selector: 'app-sedes',
  imports: [FormsModule, Mapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h">
      <h1>Sedes</h1>
      <button class="btn main" type="button" (click)="nueva()">+ Nueva sede</button>
    </div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (panel(); as p) {
      <section class="panel" style="margin-bottom:16px">
        <h3>¿Cómo es el menú en tus sedes?</h3>
        <div class="opts">
          <label class="opt"><input type="radio" name="menu" value="COMPARTIDO" [checked]="p.menu === 'COMPARTIDO'" (change)="menu('COMPARTIDO')">
            <span><b>El mismo en todas</b><br><span class="muted">Mismos productos y precios. Cada sede solo marca lo que se le agotó.</span></span></label>
          <label class="opt"><input type="radio" name="menu" value="POR_SEDE" [checked]="p.menu === 'POR_SEDE'" (change)="menu('POR_SEDE')">
            <span><b>Personalizado por sede</b><br><span class="muted">Cada sede escoge qué productos vende y puede tener su propio precio.</span></span></label>
        </div>
        <span class="hint">Lo de cada producto por sede se cambia en «Productos» con el botón «Por sede».</span>
      </section>

      <div class="panel tablewrap tabla-datos" style="padding:0;margin-bottom:16px">
        <table style="min-width:640px">
          <thead><tr><th>Sede</th><th>Dirección</th><th>Tiempo</th><th>Estado</th><th class="r"></th></tr></thead>
          <tbody>
            @for (s of p.sedes; track s.id) {
              <tr [class.apagada]="!s.activa">
                <td><b>{{ s.nombre }}</b>@if (s.principal) { <span class="chip" style="margin-left:6px">Principal</span> }</td>
                <td>{{ s.direccion || '—' }}{{ s.ciudad ? ', ' + s.ciudad : '' }}@if (s.localLat == null) { <div class="muted">Sin ubicación en el mapa</div> }</td>
                <td class="num">{{ s.tiempoMin }}–{{ s.tiempoMax }} min</td>
                <td>
                  <span class="st" [class.pay-RECIBIDO]="s.activa && s.abierta" [class.pay-PENDIENTE]="!s.activa || !s.abierta">
                    {{ !s.activa ? 'Desactivada' : s.abierta ? 'Abierta' : 'Cerrada' }}</span>
                </td>
                <td class="r"><button class="btn" type="button" (click)="editar(s)">Editar</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (f(); as s) {
      <form class="panel" style="margin-bottom:40px" (ngSubmit)="guardar()">
        <h3>{{ editando() ? 'Editar sede' : 'Nueva sede' }}</h3>
        <div class="row2">
          <div class="field"><label for="sNombre">Nombre</label><input id="sNombre" name="sNombre" [ngModel]="s.nombre" (ngModelChange)="campo({ nombre: $event })" placeholder="Sede Norte"></div>
          <div class="field"><label for="sWa">WhatsApp de la sede <span class="hint">(opcional)</span></label>
            <input id="sWa" name="sWa" inputmode="tel" [ngModel]="s.whatsapp" (ngModelChange)="campo({ whatsapp: $event })" placeholder="Si se deja vacío, el de la tienda"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="sDir">Dirección</label><input id="sDir" name="sDir" [ngModel]="s.direccion" (ngModelChange)="campo({ direccion: $event })"></div>
          <div class="field"><label for="sCiu">Ciudad</label><input id="sCiu" name="sCiu" [ngModel]="s.ciudad" (ngModelChange)="campo({ ciudad: $event })"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="sTmin">Tiempo de entrega mínimo (min)</label><input id="sTmin" name="sTmin" type="number" min="0" [ngModel]="s.tiempoMin" (ngModelChange)="campo({ tiempoMin: +$event })"></div>
          <div class="field"><label for="sTmax">Tiempo de entrega máximo (min)</label><input id="sTmax" name="sTmax" type="number" min="0" [ngModel]="s.tiempoMax" (ngModelChange)="campo({ tiempoMax: +$event })"></div>
        </div>
        <div class="row" style="gap:16px;flex-wrap:wrap">
          <label class="check"><input type="checkbox" name="sAbierta" [ngModel]="s.abierta" (ngModelChange)="campo({ abierta: $event })"> Abierta (recibe pedidos en su horario)</label>
          @if (!esPrincipal()) {
            <label class="check"><input type="checkbox" name="sActiva" [ngModel]="s.activa" (ngModelChange)="campo({ activa: $event })"> Activa (los clientes la ven)</label>
          }
        </div>

        <div class="field"><span class="flabel">Horario</span>
          @for (h of s.horarios; track h.dia; let i = $index) {
            <div class="row" style="gap:8px">
              <label class="check" style="min-width:120px"><input type="checkbox" [name]="'hA' + i" [ngModel]="h.activo" (ngModelChange)="horario(i, { activo: $event })"> {{ dias[h.dia] }}</label>
              <input type="time" [name]="'hAb' + i" [ngModel]="h.abre" (ngModelChange)="horario(i, { abre: $event })" [disabled]="!h.activo" style="width:auto" aria-label="Abre">
              <span class="muted">a</span>
              <input type="time" [name]="'hCi' + i" [ngModel]="h.cierra" (ngModelChange)="horario(i, { cierra: $event })" [disabled]="!h.activo" style="width:auto" aria-label="Cierra">
            </div>
          }
        </div>

        @if (conMapas()) {
          <div class="field"><span class="flabel">Ubicación de la sede</span>
            <div class="ubicacion-acciones">
              <input name="sBuscar" [ngModel]="texto()" (ngModelChange)="texto.set($event)" (keydown.enter)="$event.preventDefault(); buscar()" placeholder="Dirección de la sede, ciudad">
              <button class="btn" type="button" (click)="buscar()">Buscar</button>
            </div>
            <app-mapa [marcadores]="marcadores()" movible="local" [radioKm]="radio()" [alto]="280" etiqueta="Ubicación de la sede"
                      (movido)="campo({ localLat: $event.lat, localLng: $event.lng })" />
            <span class="hint">Toca el mapa o arrastra el pin hasta la puerta de la sede.</span>
          </div>
          <div class="field"><span class="flabel">Tramos de domicilio de esta sede <span class="hint">(si cobras por distancia)</span></span>
            @for (t of s.tramos; track $index; let i = $index) {
              <div class="row" style="gap:8px">
                <span class="muted" style="min-width:44px">Hasta</span>
                <input type="number" min="0.1" step="0.5" [name]="'tk' + i" [ngModel]="t.hastaKm" (ngModelChange)="tramo(i, { hastaKm: +$event })" style="width:90px" aria-label="Kilómetros">
                <span class="muted">km</span>
                <input type="number" min="0" step="500" [name]="'tv' + i" [ngModel]="t.valor" (ngModelChange)="tramo(i, { valor: +$event })" style="width:120px" aria-label="Valor">
                <button class="linkbtn" type="button" (click)="quitarTramo(i)">Quitar</button>
              </div>
            }
            <div><button class="btn" type="button" (click)="agregarTramo()">+ Agregar tramo</button></div>
            @if (s.tramos.length) { <span class="hint">{{ resumen() }}</span> }
          </div>
        }

        <div class="row">
          <button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar sede' }}</button>
          <button class="linkbtn" type="button" (click)="f.set(null)">Cancelar</button>
        </div>
      </form>
    }
  `,
})
export class SedesPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  private estado = inject(EstadoTienda);

  protected readonly dias = DIAS;
  protected panel = signal<PanelSedes | null>(null);
  protected error = signal('');
  protected f = signal<SedeForm | null>(null);
  protected editando = signal<SedeAdmin | null>(null);
  protected guardando = signal(false);
  protected texto = signal('');

  protected conMapas = computed(() => this.estado.tieneModulo(MODULOS.mapas));
  protected esPrincipal = computed(() => !!this.editando()?.principal);
  protected marcadores = computed<Marcador[]>(() => {
    const s = this.f();
    return s?.localLat != null && s.localLng != null ? [{ id: 'local', lat: s.localLat, lng: s.localLng, tipo: 'local', texto: s.nombre }] : [];
  });
  protected radio = computed(() => { const t = this.f()?.tramos ?? []; return t.length ? Math.max(...t.map((x) => x.hastaKm)) : null; });
  protected resumen = computed(() => [...(this.f()?.tramos ?? [])].sort((a, b) => a.hastaKm - b.hastaKm)
    .map((t) => `hasta ${t.hastaKm} km ${dinero(t.valor)}`).join(' · '));

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.sedes().subscribe({ next: (p) => this.panel.set(p), error: (e) => this.error.set(mensajeError(e)) });
  }

  protected menu(m: MenuSedes): void {
    this.api.menuSedes(m).subscribe({
      next: (p) => { this.panel.set(p); this.avisos.mostrar(m === 'POR_SEDE' ? 'Menú personalizado por sede' : 'El mismo menú en todas las sedes'); },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  protected nueva(): void {
    const principal = this.panel()?.sedes.find((s) => s.principal);
    this.editando.set(null);
    this.texto.set('');
    this.f.set({
      nombre: '', direccion: '', ciudad: principal?.ciudad ?? '', whatsapp: '', localLat: null, localLng: null,
      tramos: principal?.tramos ?? [], abierta: true, tiempoMin: principal?.tiempoMin ?? 30, tiempoMax: principal?.tiempoMax ?? 45,
      activa: true, horarios: principal?.horarios.map((h) => ({ ...h })) ?? HORARIO_BASE,
    });
  }

  protected editar(s: SedeAdmin): void {
    this.editando.set(s);
    this.texto.set([s.direccion, s.ciudad].filter(Boolean).join(', '));
    const { id: _id, principal: _p, ...form } = s;
    this.f.set({ ...form, horarios: s.horarios.map((h) => ({ ...h })), tramos: s.tramos.map((t) => ({ ...t })) });
  }

  protected campo(p: Partial<SedeForm>): void { this.f.update((s) => s && { ...s, ...p }); }
  protected horario(i: number, p: Partial<SedeForm['horarios'][number]>): void {
    this.f.update((s) => s && { ...s, horarios: s.horarios.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  }
  protected tramo(i: number, p: Partial<Tramo>): void {
    this.f.update((s) => s && { ...s, tramos: s.tramos.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  }
  protected quitarTramo(i: number): void { this.f.update((s) => s && { ...s, tramos: s.tramos.filter((_, j) => j !== i) }); }
  protected agregarTramo(): void {
    this.f.update((s) => {
      if (!s) return s;
      const u = s.tramos[s.tramos.length - 1];
      return { ...s, tramos: [...s.tramos, { hastaKm: (u?.hastaKm ?? 0) + 2, valor: (u?.valor ?? 2000) + 2000 }] };
    });
  }

  protected async buscar(): Promise<void> {
    if (!this.texto().trim()) return;
    try {
      const s = this.f();
      const r = await buscarDireccion(this.texto(), s?.localLat != null && s.localLng != null ? { lat: s.localLat, lng: s.localLng } : null);
      if (r[0]) this.campo({ localLat: r[0].lat, localLng: r[0].lng });
      else this.avisos.mostrar('No encontramos esa dirección: toca el mapa donde queda la sede.');
    } catch {
      this.avisos.mostrar('No pudimos buscar la dirección. Toca el mapa donde queda la sede.');
    }
  }

  protected guardar(): void {
    const s = this.f();
    if (!s) return;
    if (!s.nombre.trim()) { this.avisos.mostrar('Escribe el nombre de la sede.'); return; }
    this.guardando.set(true);
    this.api.guardarSede(this.editando()?.id ?? null, { ...s, whatsapp: s.whatsapp.replace(/\D/g, ''), tramos: s.tramos.filter((t) => t.hastaKm > 0) }).subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.panel.set(p);
        this.f.set(null);
        this.estado.cargar();
        this.avisos.mostrar('Sede guardada');
      },
      error: (e) => { this.guardando.set(false); this.avisos.mostrar(mensajeError(e)); },
    });
  }
}
