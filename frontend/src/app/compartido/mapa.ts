import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, untracked, viewChild } from '@angular/core';
import * as L from 'leaflet';

/** Un punto en el mapa. tipo define el ícono: el local, el punto de entrega, el domiciliario. */
export interface Marcador {
  id: string; lat: number; lng: number; tipo: 'local' | 'destino' | 'moto';
  /** Texto del globo al tocarlo. */
  texto?: string;
}

const EMOJI: Record<Marcador['tipo'], string> = { local: '🏪', destino: '🏠', moto: '🛵' };

/** Centro de Colombia, por si no hay ningún punto. */
const COLOMBIA: L.LatLngExpression = [4.6, -74.08];

/**
 * Mapa de OpenStreetMap (Leaflet). Muestra marcadores, opcionalmente uno se puede arrastrar (o poner con un toque)
 * y un círculo con el radio de cobertura. Ajusta la vista a los puntos cuando cambian cuáles hay.
 */
@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #lienzo class="mapa" [style.height.px]="alto()" role="region" [attr.aria-label]="etiqueta()"></div>`,
})
export class Mapa {
  readonly marcadores = input<Marcador[]>([]);
  /** id del marcador que el usuario puede mover (arrastrándolo o tocando el mapa). */
  readonly movible = input<string | null>(null);
  /** Radio de cobertura alrededor del local (km). */
  readonly radioKm = input<number | null>(null);
  readonly alto = input(300);
  readonly etiqueta = input('Mapa');
  /** El usuario movió el marcador «movible». */
  readonly movido = output<{ lat: number; lng: number }>();

  private lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  private mapa: L.Map | null = null;
  private capas = new Map<string, L.Marker>();
  private circulo: L.Circle | null = null;
  private ids = '';

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      const mapa = L.map(this.lienzo().nativeElement, { zoomControl: true, attributionControl: true }).setView(COLOMBIA, 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(mapa);
      mapa.on('click', (e: L.LeafletMouseEvent) => {
        if (this.movible()) this.movido.emit({ lat: redondear(e.latlng.lat), lng: redondear(e.latlng.lng) });
      });
      this.mapa = mapa;
      // El contenedor puede cambiar de tamaño (pestañas, paneles que se abren): Leaflet necesita saberlo.
      const ro = new ResizeObserver(() => mapa.invalidateSize());
      ro.observe(this.lienzo().nativeElement);
      destruir.onDestroy(() => { ro.disconnect(); mapa.remove(); });
      this.dibujar();
    });
    effect(() => {
      this.marcadores();
      this.movible();
      this.radioKm();
      untracked(() => this.dibujar());
    });
  }

  private dibujar(): void {
    const mapa = this.mapa;
    if (!mapa) return;
    const lista = this.marcadores().filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    const vigentes = new Set(lista.map((m) => m.id));
    for (const [id, capa] of this.capas) {
      if (!vigentes.has(id)) { capa.remove(); this.capas.delete(id); }
    }
    for (const m of lista) {
      const arrastrable = m.id === this.movible();
      let capa = this.capas.get(m.id);
      if (!capa) {
        capa = L.marker([m.lat, m.lng], {
          draggable: arrastrable, keyboard: false,
          icon: L.divIcon({ className: 'mk-envoltura', html: `<span class="mk mk-${m.tipo}"><i>${EMOJI[m.tipo]}</i></span>`, iconSize: [40, 40], iconAnchor: [20, 36] }),
        }).addTo(mapa);
        if (arrastrable) capa.on('dragend', () => { const p = capa!.getLatLng(); this.movido.emit({ lat: redondear(p.lat), lng: redondear(p.lng) }); });
        this.capas.set(m.id, capa);
      } else {
        capa.setLatLng([m.lat, m.lng]);
      }
      if (m.texto) capa.bindPopup(m.texto); else capa.unbindPopup();
    }

    const local = lista.find((m) => m.tipo === 'local');
    const radio = this.radioKm();
    if (local && radio) {
      if (!this.circulo) this.circulo = L.circle([local.lat, local.lng], { radius: radio * 1000, color: '#E4572E', weight: 1.5, fillOpacity: 0.06 }).addTo(mapa);
      else this.circulo.setLatLng([local.lat, local.lng]).setRadius(radio * 1000);
    } else if (this.circulo) {
      this.circulo.remove();
      this.circulo = null;
    }

    // Se reencuadra solo cuando cambian cuáles puntos hay (no cada vez que el domiciliario se mueve).
    const ids = lista.map((m) => m.id).sort().join(',');
    if (ids !== this.ids) {
      this.ids = ids;
      if (lista.length === 1) mapa.setView([lista[0]!.lat, lista[0]!.lng], 16);
      else if (lista.length > 1) mapa.fitBounds(L.latLngBounds(lista.map((m) => [m.lat, m.lng] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 16 });
    } else {
      const moto = lista.find((m) => m.tipo === 'moto');
      if (moto && !mapa.getBounds().contains([moto.lat, moto.lng])) mapa.panTo([moto.lat, moto.lng]);
    }
  }
}

function redondear(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** km en línea recta (igual que el servidor), para mostrar la distancia mientras se mueve el punto. */
export function kmEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Busca una dirección en OpenStreetMap (Nominatim), cerca del local si se conoce. */
export async function buscarDireccion(texto: string, cerca: { lat: number; lng: number } | null, ciudad = ''): Promise<{ nombre: string; lat: number; lng: number }[]> {
  const q = new URLSearchParams({ format: 'jsonv2', limit: '5', countrycodes: 'co', 'accept-language': 'es', q: ciudad && !texto.toLowerCase().includes(ciudad.toLowerCase()) ? `${texto}, ${ciudad}` : texto });
  if (cerca) {
    const d = 0.25; // ~25 km alrededor del local, sin limitar a esa caja
    q.set('viewbox', [cerca.lng - d, cerca.lat + d, cerca.lng + d, cerca.lat - d].join(','));
  }
  const r = await fetch('https://nominatim.openstreetmap.org/search?' + q.toString(), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pudimos buscar la dirección.');
  const lista = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return lista.map((x) => ({ nombre: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
}

/** Ubicación actual del celular o computador (pide permiso). */
export function miUbicacion(): Promise<{ lat: number; lng: number; precision: number }> {
  return new Promise((ok, falla) => {
    if (!('geolocation' in navigator)) { falla(new Error('Este navegador no comparte la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: redondear(p.coords.latitude), lng: redondear(p.coords.longitude), precision: Math.round(p.coords.accuracy) }),
      (e) => falla(new Error(e.code === e.PERMISSION_DENIED ? 'No diste permiso para usar tu ubicación.' : 'No pudimos saber tu ubicación.')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  });
}
