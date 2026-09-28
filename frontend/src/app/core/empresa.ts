import { Injectable, signal } from '@angular/core';
import { CanActivateFn, CanMatchFn, UrlSegment } from '@angular/router';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;
/** Origen del servidor (sin /api), para armar direcciones que el backend entrega como "/api/…". */
const ORIGEN = API.replace(/\/api\/?$/, '');

/** Palabras que no pueden ser el identificador de una empresa (coinciden con el backend). */
const RESERVADOS = new Set(['superadmin', 'admin', 'api', 'plataforma', 'assets', 'static', 'public', 'publico',
  'login', 'entrar', 'seguimiento', 'carrito', 'pedido', 'favicon', 'index', 'leinei']);

let slugGlobal = '';

/**
 * Empresa en la que está el usuario.
 * - En la dirección de la plataforma: /{empresa}/…  (ej. /la-parrilla/carrito)
 * - En un dominio propio (pedidos.laparrilla.com): la empresa se resuelve por el dominio y las rutas no llevan prefijo.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaActual {
  /** Identificador de la empresa actual ("" fuera de una tienda). */
  readonly slug = signal('');
  /** true cuando la app se abrió desde el dominio propio de una empresa. */
  readonly dominioPropio = signal(false);

  fijar(slug: string): void {
    slugGlobal = slug;
    if (this.slug() !== slug) this.slug.set(slug);
  }

  /** Ruta dentro de la tienda actual: "/carrito" → "/la-parrilla/carrito" (o "/carrito" en dominio propio). */
  url(ruta = ''): string {
    const limpia = ruta.startsWith('/') ? ruta : '/' + ruta;
    if (this.dominioPropio()) return limpia === '/' ? '/' : limpia.replace(/\/$/, '');
    return ('/' + this.slug() + (limpia === '/' ? '' : limpia));
  }

  /** Clave de almacenamiento separada por empresa (el carrito de una tienda no aparece en otra). */
  clave(nombre: string): string {
    this.slug(); // para que computed/effect reaccionen al cambio de empresa
    return claveLocal(nombre);
  }

  /** Pregunta una sola vez al arrancar si este dominio pertenece a una empresa. */
  async resolverDominio(): Promise<void> {
    try {
      const r = await fetch(`${API}/plataforma/publico/dominio?host=${encodeURIComponent(location.hostname)}`);
      if (!r.ok) return;
      const d = (await r.json()) as { identificador: string | null };
      if (d.identificador) {
        this.dominioPropio.set(true);
        this.fijar(d.identificador);
      }
    } catch { /* sin conexión: se sigue en modo plataforma */ }
  }
}

/** Clave de almacenamiento local de la empresa actual (para funciones fuera de un servicio). */
export function claveLocal(nombre: string): string {
  return `leinei:${slugGlobal}:${nombre}`;
}

/** Base de la API de la empresa actual. */
export function apiEmpresa(): string {
  return `${API}/t/${encodeURIComponent(slugGlobal)}`;
}

/** Dirección de una imagen de producto de la empresa actual. */
export function urlImagen(id: number | null | undefined): string | null {
  return id ? `${apiEmpresa()}/public/archivos/${id}` : null;
}

/** Convierte "/api/…" (como la entrega el backend) en una dirección completa. */
export function urlServidor(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return ruta.startsWith('/') ? ORIGEN + ruta : ruta; // blob:, data:, https://… se dejan igual
}

export function identificadorValido(s: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 30 && !RESERVADOS.has(s);
}

/** La tienda sin prefijo solo aplica en un dominio propio. */
export const esDominioPropio: CanMatchFn = () => inject(EmpresaActual).dominioPropio();

/** /{empresa}/… solo si el primer segmento parece un identificador y no estamos en un dominio propio. */
export const esRutaDeEmpresa: CanMatchFn = (_r, segmentos: UrlSegment[]) =>
  !inject(EmpresaActual).dominioPropio() && !!segmentos[0] && identificadorValido(segmentos[0].path);

/** Deja fija la empresa del primer segmento de la ruta. */
export const fijarEmpresa: CanActivateFn = (ruta) => {
  const emp = inject(EmpresaActual);
  const slug = ruta.paramMap.get('empresa');
  if (slug) emp.fijar(slug);
  return true;
};
