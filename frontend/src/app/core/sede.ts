import { Injectable, inject, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { EmpresaActual, claveLocal } from './empresa';

/**
 * Sede escogida (empresas con varias sedes), guardada en este navegador por empresa:
 *  - tienda: dónde pide el cliente.
 *  - portal: el filtro de la barra del portal (null = todas las sedes).
 * Se manda a la API en el encabezado X-Sede (ver sedeInterceptor).
 */
@Injectable({ providedIn: 'root' })
export class SedeElegida {
  private emp = inject(EmpresaActual);

  /** Cambia cada vez que se escoge otra sede (las páginas recargan sus datos). */
  readonly version = signal(0);
  /** Pide abrir el modal de sedes (por ejemplo, desde el aviso de «estamos cerrados»). */
  readonly abrirSelector = signal(0);
  /** Si en esta visita (desde que abrió la página) ya escogió o confirmó la sede: el modal se lo pregunta al entrar. */
  readonly escogidaEnVisita = signal(false);

  tienda(): number | null { return leerNumero(claveLocal('sede')); }
  portal(): number | null { return leerNumero(claveLocal('sede-portal')); }

  /** Si el cliente ya escogió sede en este navegador. */
  tiendaEscogida(): boolean { return this.tienda() != null; }

  fijarTienda(id: number | null): void {
    guardar(claveLocal('sede'), id);
    this.escogidaEnVisita.set(true);
    this.version.update((v) => v + 1);
  }

  fijarPortal(id: number | null): void {
    guardar(claveLocal('sede-portal'), id);
    this.version.update((v) => v + 1);
  }

  /** Para el interceptor: la sede que corresponde a la URL (portal o tienda) de la empresa actual. */
  paraUrl(url: string): number | null {
    if (!this.emp.slug() && !this.emp.dominioPropio()) return null;
    if (url.includes('/admin/')) return this.portal();
    // Dentro del portal, los datos de la tienda (horario, «estamos llenos»…) también son los de la sede del filtro.
    if (url.includes('/public/')) return enPortal() ? this.portal() : this.tienda();
    return null;
  }
}

/** Agrega X-Sede a las llamadas de la tienda y del portal de la empresa. */
export const sedeInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/t/')) return next(req);
  const sede = inject(SedeElegida).paraUrl(req.url);
  return next(sede != null ? req.clone({ setHeaders: { 'X-Sede': String(sede) } }) : req);
};

function enPortal(): boolean {
  return typeof location !== 'undefined' && /\/admin(\/|$)/.test(location.pathname);
}

function leerNumero(clave: string): number | null {
  try {
    const v = localStorage.getItem(clave);
    return v && /^\d+$/.test(v) ? Number(v) : null;
  } catch { return null; }
}

function guardar(clave: string, id: number | null): void {
  try {
    if (id == null) localStorage.removeItem(clave); else localStorage.setItem(clave, String(id));
  } catch { /* sin almacenamiento: queda solo para esta visita */ }
}
