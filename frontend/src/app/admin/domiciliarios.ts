import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Icono } from '../compartido/icono';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { AvisosPortal } from '../core/avisos-portal';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe, copiar, linkWhatsapp } from '../core/formato';
import { Domiciliario, MODULOS, UbicacionDomiciliario } from '../core/modelos';
import { Mapa, Marcador } from '../compartido/mapa';

/** Personas que llevan los domicilios. Se asignan a cada pedido desde «Pedidos». */
@Component({
  selector: 'app-domiciliarios',
  imports: [Icono, FormsModule, CelularPipe, Mapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (conMapas()) {
      <section class="panel" style="margin-bottom:16px">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap">
          <h3><app-icono nombre="domiciliarios" /> Domiciliarios en el mapa</h3>
          <span class="en-vivo" [class.off]="!avisosPortal.enVivo()">{{ avisosPortal.enVivo() ? 'En vivo' : 'Reconectando' }}</span>
        </div>
        @if (ubicaciones().length) {
          <app-mapa [marcadores]="marcadores()" [alto]="300" etiqueta="Domiciliarios en el mapa" />
          <div class="row" style="gap:12px;flex-wrap:wrap">
            @for (u of ubicaciones(); track u.id) {
              <span [class.muted]="!vigente(u)"><b>{{ u.nombre }}</b> · {{ vigente(u) ? 'hace ' + hace(u.actualizado) : 'sin señal desde hace ' + hace(u.actualizado) }}{{ u.enCamino ? ' · ' + u.enCamino + ' en camino' : '' }}</span>
            }
          </div>
        } @else {
          <p class="muted">Cuando un domiciliario abra su link de reparto y comparta su ubicación, aparecerá aquí.</p>
        }
      </section>
    }

    <div class="two" style="margin-bottom:40px">
      <div class="panel">
        <h3>Domiciliarios</h3>
        <p class="muted">Asígnalos a cada pedido a domicilio desde «Pedidos». Al asignarlo puedes enviarle el pedido por WhatsApp,
          y el cliente ve quién le lleva su pedido.
          @if (conMapas()) { Con su <b>link de reparto</b> (botón «Link») ve sus pedidos en el celular, marca «Salí» y «Entregado», y el cliente lo ve acercarse en el mapa. }</p>
        <div class="tablewrap tabla-datos" style="margin-inline:-16px;margin-bottom:-16px">
          <table>
            <thead><tr><th>Nombre</th><th>Celular</th><th>Estado</th><th class="r">Acciones</th></tr></thead>
            <tbody>
              @for (d of lista(); track d.id) {
                @if (editando() === d.id) {
                  <tr>
                    <td colspan="4">
                      <form class="stack" style="gap:8px" (ngSubmit)="guardar(d.id)">
                        <div class="row2">
                          <div class="field"><label [for]="'en' + d.id">Nombre</label><input [id]="'en' + d.id" name="en" [(ngModel)]="edicion.nombre"></div>
                          <div class="field"><label [for]="'ec' + d.id">Celular</label><input [id]="'ec' + d.id" name="ec" inputmode="tel" [(ngModel)]="edicion.celular"></div>
                        </div>
                        <label class="check"><input type="checkbox" name="ea" [(ngModel)]="edicion.activo"> Activo</label>
                        <div class="row"><button class="btn main" type="submit">Guardar</button><button class="btn" type="button" (click)="editando.set(null)">Cancelar</button>
                          @if (conMapas()) { <button class="linkbtn" type="button" (click)="renovar(d.id)" title="El link anterior deja de servir">Cambiar su link de reparto</button> }</div>
                      </form>
                    </td>
                  </tr>
                } @else {
                  <tr [class.apagada]="!d.activo">
                    <td><b>{{ d.nombre }}</b></td>
                    <td class="num">{{ d.celular | celular }}</td>
                    <td><span class="st" [class.pay-RECIBIDO]="d.activo" [class.pay-PENDIENTE]="!d.activo">{{ d.activo ? 'Activo' : 'Inactivo' }}</span></td>
                    <td class="r">
                      @if (conMapas() && d.activo && d.token) {
                        <button class="btn" type="button" (click)="copiarLink(d)" title="Copiar su link de reparto"><app-icono nombre="enlace" /> Link</button>
                        @if (d.celular) { <a class="btn" [href]="waLink(d)" target="_blank" rel="noopener" title="Enviarle su link por WhatsApp" aria-label="Enviarle su link por WhatsApp"><app-icono nombre="chat" /></a> }
                      }
                      <button class="btn" type="button" (click)="editar(d)">Editar</button>
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="4" class="vacio">Todavía no tienes domiciliarios.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <form class="panel" (ngSubmit)="crear(f)" #f="ngForm">
        <h3>Agregar domiciliario</h3>
        <div class="field"><label for="dNombre">Nombre</label><input id="dNombre" name="dNombre" [(ngModel)]="nuevo.nombre"></div>
        <div class="field"><label for="dCel">Celular <span class="hint">(para enviarle los pedidos por WhatsApp)</span></label>
          <input id="dCel" name="dCel" inputmode="tel" [(ngModel)]="nuevo.celular" placeholder="3001234567"></div>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <div><button class="btn main" type="submit">Agregar</button></div>
      </form>
    </div>
  `,
})
export class DomiciliariosPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  private estado = inject(EstadoTienda);
  private emp = inject(EmpresaActual);
  protected avisosPortal = inject(AvisosPortal);

  protected conMapas = computed(() => this.estado.tieneModulo(MODULOS.mapas));
  protected ubicaciones = signal<UbicacionDomiciliario[]>([]);
  private ahora = signal(Date.now());
  protected marcadores = computed<Marcador[]>(() => {
    const t = this.estado.catalogo()?.tienda.entrega;
    const lista: Marcador[] = this.ubicaciones().map((u) => ({ id: 'd' + u.id, lat: u.lat, lng: u.lng, tipo: 'moto', texto: u.nombre }));
    if (t?.localLat != null && t.localLng != null) lista.unshift({ id: 'local', lat: t.localLat, lng: t.localLng, tipo: 'local', texto: 'El local' });
    return lista;
  });

  protected lista = signal<Domiciliario[]>([]);
  protected editando = signal<number | null>(null);
  protected error = signal('');
  protected nuevo = { nombre: '', celular: '' };
  protected edicion = { nombre: '', celular: '', activo: true };

  constructor() {
    this.api.domiciliarios().subscribe({ next: (l) => this.lista.set(l), error: (e) => this.error.set(mensajeError(e)) });
    effect(() => { if (this.conMapas()) untracked(() => this.cargarUbicaciones()); });
    // Cada ubicación nueva llega en vivo: se mueve el punto sin recargar.
    effect(() => {
      const u = this.avisosPortal.ubicacion();
      if (!u) return;
      untracked(() => {
        const existe = this.ubicaciones().some((x) => x.id === u.id);
        if (!existe) { this.cargarUbicaciones(); return; }
        this.ubicaciones.update((l) => l.map((x) => (x.id === u.id ? { ...x, lat: u.lat, lng: u.lng, actualizado: u.t, vigente: true } : x)));
      });
    });
    const reloj = setInterval(() => this.ahora.set(Date.now()), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  private cargarUbicaciones(): void {
    this.api.ubicacionesDomiciliarios().subscribe({ next: (l) => this.ubicaciones.set(l), error: () => {} });
  }

  protected vigente(u: UbicacionDomiciliario): boolean { return this.ahora() - new Date(u.actualizado).getTime() < 5 * 60_000; }

  protected hace(iso: string): string {
    const s = Math.max(0, Math.round((this.ahora() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'unos segundos';
    if (s < 3600) return Math.round(s / 60) + ' min';
    return Math.round(s / 3600) + ' h';
  }

  private link(d: Domiciliario): string { return location.origin + this.emp.url('/reparto/' + d.token); }

  protected async copiarLink(d: Domiciliario): Promise<void> {
    this.avisos.mostrar((await copiar(this.link(d))) ? `Link de ${d.nombre} copiado` : this.link(d));
  }

  protected waLink(d: Domiciliario): string {
    return linkWhatsapp(d.celular, `Hola ${d.nombre}, este es tu link de reparto de ${this.estado.catalogo()?.tienda.nombre ?? ''}. `
      + `Ábrelo en tu celular cuando salgas a repartir (ahí ves tus pedidos y compartes tu ubicación): ${this.link(d)}`);
  }

  protected renovar(id: number): void {
    this.api.renovarLinkReparto(id).subscribe({
      next: (l) => { this.lista.set(l); this.avisos.mostrar('Link cambiado: el anterior ya no sirve. Envíale el nuevo.'); },
      error: (e) => this.avisos.mostrar(mensajeError(e)),
    });
  }

  protected editar(d: Domiciliario): void {
    this.edicion = { nombre: d.nombre, celular: d.celular, activo: d.activo };
    this.editando.set(d.id);
  }

  protected guardar(id: number): void {
    const e = this.edicion;
    this.api.guardarDomiciliario(id, { nombre: e.nombre.trim(), celular: e.celular.replace(/\D/g, ''), activo: e.activo }).subscribe({
      next: (l) => { this.lista.set(l); this.editando.set(null); this.avisos.mostrar('Domiciliario actualizado'); },
      error: (err) => this.avisos.mostrar(mensajeError(err)),
    });
  }

  protected crear(form: NgForm): void {
    const n = this.nuevo;
    const cel = n.celular.replace(/\D/g, '');
    if (!n.nombre.trim()) { this.error.set('Escribe el nombre.'); return; }
    if (cel && !/^3\d{9}$/.test(cel)) { this.error.set('El celular debe tener 10 dígitos y empezar por 3.'); return; }
    this.api.guardarDomiciliario(null, { nombre: n.nombre.trim(), celular: cel, activo: true }).subscribe({
      next: (l) => {
        this.lista.set(l);
        form.resetForm();
        this.nuevo = { nombre: '', celular: '' };
        this.error.set('');
        this.avisos.mostrar('Domiciliario agregado');
      },
      error: (err) => this.error.set(mensajeError(err)),
    });
  }
}
