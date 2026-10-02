import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Icono } from '../compartido/icono';
import { TiendaApi, mensajeError } from '../core/api';
import { CelularPipe, dinero, linkWhatsapp } from '../core/formato';
import { Reparto, PedidoReparto } from '../core/modelos';
import { Mapa, Marcador, kmEntre } from '../compartido/mapa';

/** Cada cuánto se manda la ubicación como máximo, y a partir de cuántos metros de movimiento se manda antes. */
const CADA_MS = 15_000;
const METROS = 30;

/**
 * Página del domiciliario (su link personal): sus pedidos con la dirección, lo que debe cobrar y botones para navegar,
 * llamar, «Salí» y «Entregado». Mientras la tiene abierta y comparte su ubicación, el cliente lo ve acercarse.
 * No hay que instalar nada ni iniciar sesión: el link es la clave.
 */
@Component({
  selector: 'app-reparto',
  imports: [Icono, CelularPipe, Mapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap reparto">
      @if (datos(); as d) {
        <header class="stack" style="gap:2px;padding-top:16px">
          <span class="muted">{{ d.tienda }} · Reparto</span>
          <h1 style="font-size:26px">Hola, {{ d.domiciliario }}</h1>
        </header>

        <section class="panel">
          @if (compartiendo()) {
            <div class="row" style="justify-content:space-between;flex-wrap:wrap">
              <span><span class="en-vivo">Compartiendo</span> {{ ultimoEnvio() ? 'Última hace ' + segundos() + ' s' : 'Buscando tu ubicación…' }}</span>
              <button class="btn" type="button" (click)="detener()">Dejar de compartir</button>
            </div>
            <span class="hint">Deja esta página abierta mientras repartes. {{ pantallaActiva() ? 'La pantalla no se apagará.' : '' }}</span>
          } @else {
            <button class="primary" type="button" (click)="compartir()"><app-icono nombre="pin" /> Empezar a compartir mi ubicación</button>
            <span class="hint">{{ d.seguimientoVivo ? 'Así tus clientes ven que vas en camino.' : 'El negocio ve dónde vas.' }} Solo se comparte mientras esta página esté abierta.</span>
          }
          @if (aviso()) { <p class="err">{{ aviso() }}</p> }
        </section>

        @if (marcadores().length) { <app-mapa [marcadores]="marcadores()" [alto]="260" etiqueta="Mapa de tus entregas" /> }

        @for (p of d.pedidos; track p.codigo) {
          <article class="panel reparto-pedido" [class.camino]="p.estado === 'EN_CAMINO'">
            <div class="row" style="justify-content:space-between">
              <b class="num" style="font-size:20px">{{ p.codigo }}</b>
              <span class="st st-{{ p.estado }}">{{ p.estado === 'EN_CAMINO' ? 'En camino' : p.estado === 'PREPARANDO' ? 'Preparando' : p.estado === 'NUEVO' ? 'Nuevo' : 'Confirmado' }}</span>
            </div>
            <div><b>{{ p.cliente }}</b>@if (p.celular) { · <a class="num" [href]="'tel:' + p.celular">{{ p.celular | celular }}</a> }</div>
            <div style="font-size:16px">{{ p.direccion }}{{ p.barrio ? ', ' + p.barrio : '' }}</div>
            @if (p.referencia) { <div class="muted">{{ p.referencia }}</div> }
            <div class="muted">{{ p.productos }}</div>
            @if (p.notas) { <div class="alerta aviso"><app-icono nombre="nota" /> {{ p.notas }}</div> }
            <div class="alerta" [class.mala]="p.cobrar > 0" [class.buena]="p.cobrar === 0">
              <b>{{ p.cobrar > 0 ? 'Cobrar ' + precio(p.cobrar) + ' en efectivo' : 'Ya está pagado: no cobres' }}</b>
            </div>
            <div class="row" style="gap:8px;flex-wrap:wrap">
              <a class="btn" [href]="navegar(p)" target="_blank" rel="noopener"><app-icono nombre="brujula" /> Cómo llegar</a>
              @if (p.celular) { <a class="btn" [href]="wa(p)" target="_blank" rel="noopener"><app-icono nombre="chat" /> WhatsApp</a> }
              @if (p.estado !== 'EN_CAMINO') {
                <button class="btn main" type="button" [disabled]="ocupado() === p.codigo" (click)="avanzar(p, 'sali')"><app-icono nombre="domiciliarios" /> Salí</button>
              } @else {
                <button class="btn okb" type="button" [disabled]="ocupado() === p.codigo" (click)="avanzar(p, 'entregado')">✓ Entregado</button>
              }
            </div>
          </article>
        } @empty {
          <div class="empty">No tienes pedidos asignados ahora. Esta página se actualiza sola.</div>
        }
      } @else if (error()) {
        <div class="alerta mala" style="margin-top:24px">{{ error() }}</div>
      } @else {
        <div class="esqueleto" style="height:200px;margin-top:24px"></div>
      }
    </main>
  `,
  styles: `
    .reparto { display: grid; gap: 12px; padding-bottom: 40px; max-width: 640px; }
    .reparto-pedido { border-left: 5px solid var(--info); }
    .reparto-pedido.camino { border-left-color: var(--ok); }
  `,
})
export class RepartoPage {
  private api = inject(TiendaApi);

  readonly token = input.required<string>();

  protected datos = signal<Reparto | null>(null);
  protected error = signal('');
  protected aviso = signal('');
  protected ocupado = signal<string | null>(null);
  protected compartiendo = signal(false);
  protected pantallaActiva = signal(false);
  protected yo = signal<{ lat: number; lng: number } | null>(null);
  protected ultimoEnvio = signal(0);
  private ahora = signal(Date.now());
  private vigilancia: number | null = null;
  private candado: { release: () => Promise<void> } | null = null;
  private enviado: { lat: number; lng: number; t: number } | null = null;

  constructor() {
    queueMicrotask(() => this.cargar());
    const t = setInterval(() => this.cargar(), 30_000);
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1_000);
    inject(DestroyRef).onDestroy(() => { clearInterval(t); clearInterval(reloj); this.detener(); });
  }

  protected segundos = computed(() => Math.max(0, Math.round((this.ahora() - this.ultimoEnvio()) / 1000)));

  protected marcadores = computed<Marcador[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const lista: Marcador[] = [];
    if (d.localLat != null && d.localLng != null) lista.push({ id: 'local', lat: d.localLat, lng: d.localLng, tipo: 'local', texto: d.tienda });
    for (const p of d.pedidos) {
      if (p.lat != null && p.lng != null) lista.push({ id: 'p' + p.codigo, lat: p.lat, lng: p.lng, tipo: 'destino', texto: `${p.codigo} · ${p.cliente}` });
    }
    const yo = this.yo();
    if (yo) lista.push({ id: 'yo', ...yo, tipo: 'moto', texto: 'Tú' });
    return lista;
  });

  private cargar(): void {
    this.api.reparto(this.token()).subscribe({
      next: (d) => { this.datos.set(d); this.error.set(''); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  protected compartir(): void {
    if (!('geolocation' in navigator)) { this.aviso.set('Este celular no permite compartir la ubicación desde el navegador.'); return; }
    this.aviso.set('');
    this.compartiendo.set(true);
    this.vigilancia = navigator.geolocation.watchPosition(
      (pos) => this.nuevaPosicion(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy)),
      (e) => {
        this.aviso.set(e.code === e.PERMISSION_DENIED ? 'Diste «no permitir». Activa la ubicación para este sitio en los ajustes del navegador.' : 'No pudimos leer tu ubicación; seguimos intentando.');
        if (e.code === e.PERMISSION_DENIED) this.detener();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 });
    // Que la pantalla no se apague mientras reparte (si el navegador lo permite).
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    wl?.request('screen').then((c) => { this.candado = c; this.pantallaActiva.set(true); }).catch(() => {});
  }

  protected detener(): void {
    if (this.vigilancia != null) navigator.geolocation.clearWatch(this.vigilancia);
    this.vigilancia = null;
    this.compartiendo.set(false);
    void this.candado?.release().catch(() => {});
    this.candado = null;
    this.pantallaActiva.set(false);
  }

  /** Se manda cada 15 s, o antes si se movió más de 30 m. */
  private nuevaPosicion(lat: number, lng: number, precision: number): void {
    this.yo.set({ lat, lng });
    const ahora = Date.now();
    const e = this.enviado;
    const movido = e ? kmEntre(e, { lat, lng }) * 1000 : Infinity;
    if (e && ahora - e.t < CADA_MS && movido < METROS) return;
    this.enviado = { lat, lng, t: ahora };
    this.api.enviarUbicacion(this.token(), lat, lng, precision).subscribe({
      next: () => this.ultimoEnvio.set(ahora),
      error: (err) => this.aviso.set(mensajeError(err)),
    });
  }

  protected avanzar(p: PedidoReparto, paso: 'sali' | 'entregado'): void {
    this.ocupado.set(p.codigo);
    this.api.avanzarReparto(this.token(), p.codigo, paso).subscribe({
      next: (d) => { this.ocupado.set(null); this.datos.set(d); if (paso === 'sali' && !this.compartiendo()) this.compartir(); },
      error: (e) => { this.ocupado.set(null); this.aviso.set(mensajeError(e)); },
    });
  }

  protected precio(n: number): string { return dinero(n); }

  /** Abre Google Maps (o la app de mapas del celular) con la ruta hasta el cliente. */
  protected navegar(p: PedidoReparto): string {
    const destino = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : `${p.direccion}, ${p.barrio}`;
    return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(destino);
  }

  protected wa(p: PedidoReparto): string {
    return linkWhatsapp(p.celular, `Hola ${p.cliente.split(' ')[0]}, soy ${this.datos()?.domiciliario} de ${this.datos()?.tienda}. Voy en camino con tu pedido ${p.codigo}.`);
  }
}
