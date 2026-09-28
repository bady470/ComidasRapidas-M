import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { EmpresaActual } from './empresa';
import { Sesion } from './modelos';

const API = environment.apiUrl;
const CLAVE_SUPERADMIN = 'leinei:plataforma:sesion';

/**
 * Sesión del administrador de la empresa actual. Cada empresa guarda su propia sesión:
 * entrar al panel de una no abre el de otra.
 */
@Injectable({ providedIn: 'root' })
export class SesionAdmin {
  private emp = inject(EmpresaActual);
  private version = signal(0);

  readonly actual = computed(() => {
    this.version();
    return leer(this.emp.clave('sesion'));
  });

  iniciar(s: Sesion): void {
    try { localStorage.setItem(this.emp.clave('sesion'), JSON.stringify(s)); } catch { /* navegador sin almacenamiento */ }
    this.version.update((v) => v + 1);
  }

  cerrar(): void {
    try { localStorage.removeItem(this.emp.clave('sesion')); } catch { /* nada */ }
    this.version.update((v) => v + 1);
  }

  token(): string | null {
    return vigente(this.actual(), () => this.cerrar());
  }
}

/** Sesión del superadmin de la plataforma. */
@Injectable({ providedIn: 'root' })
export class SesionSuperadmin {
  private version = signal(0);

  readonly actual = computed(() => {
    this.version();
    return leer(CLAVE_SUPERADMIN);
  });

  iniciar(s: Sesion): void {
    try { localStorage.setItem(CLAVE_SUPERADMIN, JSON.stringify(s)); } catch { /* nada */ }
    this.version.update((v) => v + 1);
  }

  cerrar(): void {
    try { localStorage.removeItem(CLAVE_SUPERADMIN); } catch { /* nada */ }
    this.version.update((v) => v + 1);
  }

  token(): string | null {
    return vigente(this.actual(), () => this.cerrar());
  }
}

function vigente(s: Sesion | null, cerrar: () => void): string | null {
  if (!s) return null;
  if (new Date(s.expira).getTime() < Date.now()) { cerrar(); return null; }
  return s.token;
}

function leer(clave: string): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(clave) ?? 'null') as Sesion | null;
    return s && new Date(s.expira).getTime() > Date.now() ? s : null;
  } catch { return null; }
}

const ADMIN_EMPRESA = new RegExp('^' + API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/t/[^/]+/admin/');

/**
 * Agrega el token que corresponde a cada llamada:
 *  - /api/t/{empresa}/admin/**  → sesión del administrador de esa empresa
 *  - /api/plataforma/**         → sesión del superadmin (menos /plataforma/publico)
 * y saca a la pantalla de entrada correcta si la sesión ya no sirve.
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const admin = inject(SesionAdmin);
  const superadmin = inject(SesionSuperadmin);
  const emp = inject(EmpresaActual);
  const router = inject(Router);

  const esAdmin = ADMIN_EMPRESA.test(req.url);
  const esPlataforma = req.url.startsWith(`${API}/plataforma/`) && !req.url.startsWith(`${API}/plataforma/publico/`);
  const token = esAdmin ? admin.token() : esPlataforma ? superadmin.token() : null;
  const conToken = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(conToken).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && e.status === 401 && !req.url.endsWith('/auth/login')) {
        if (esAdmin) {
          admin.cerrar();
          router.navigateByUrl(emp.url('/admin/entrar'));
        } else if (esPlataforma) {
          superadmin.cerrar();
          router.navigateByUrl('/superadmin/entrar');
        }
      }
      return throwError(() => e);
    }),
  );
};

export const soloAdmin: CanActivateFn = () => {
  const emp = inject(EmpresaActual);
  return inject(SesionAdmin).token() ? true : inject(Router).parseUrl(emp.url('/admin/entrar'));
};

export const soloSuperadmin: CanActivateFn = () =>
  inject(SesionSuperadmin).token() ? true : inject(Router).parseUrl('/superadmin/entrar');
