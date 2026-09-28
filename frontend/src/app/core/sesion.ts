import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Sesion } from './modelos';

const CLAVE = 'tienda_sesion_admin';

/** Guarda la sesión del administrador en este navegador. */
@Injectable({ providedIn: 'root' })
export class SesionAdmin {
  readonly actual = signal<Sesion | null>(leer());

  iniciar(s: Sesion): void {
    try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* navegador sin almacenamiento */ }
    this.actual.set(s);
  }

  cerrar(): void {
    try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
    this.actual.set(null);
  }

  token(): string | null {
    const s = this.actual();
    if (!s) return null;
    if (new Date(s.expira).getTime() < Date.now()) { this.cerrar(); return null; }
    return s.token;
  }
}

function leer(): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Sesion | null;
    return s && new Date(s.expira).getTime() > Date.now() ? s : null;
  } catch { return null; }
}

/** Agrega el token a las llamadas del panel y saca al login si la sesión ya no sirve. */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionAdmin);
  const router = inject(Router);
  const esAdmin = req.url.startsWith(`${environment.apiUrl}/admin/`);
  const token = esAdmin ? sesion.token() : null;
  const conToken = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(conToken).pipe(
    catchError((e: unknown) => {
      if (esAdmin && e instanceof HttpErrorResponse && e.status === 401 && !req.url.endsWith('/auth/login')) {
        sesion.cerrar();
        router.navigate(['/admin/entrar']);
      }
      return throwError(() => e);
    }),
  );
};

export const soloAdmin: CanActivateFn = () => {
  const sesion = inject(SesionAdmin);
  return sesion.token() ? true : inject(Router).createUrlTree(['/admin/entrar']);
};
